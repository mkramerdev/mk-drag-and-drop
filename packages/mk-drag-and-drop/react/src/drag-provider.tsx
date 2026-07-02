import { createContext, useRef, useState, type ReactNode } from "react";

import {
  pointerToCenter,
  type DragRect,
  type DropTarget,
  type TargetingAlgorithm,
} from "@mk-drag-and-drop/core";

type Rect = DragRect;

export type Point = {
    x: number;
    y: number;
};

export type DragState = {
    itemId: string;
    sourceRect: Rect;
    startPointerPosition: Point;
    pointerPosition: Point;
};

type DragProviderProps = {
    children: ReactNode;
    dragOverlay?: (drag: DragState) => ReactNode;
    targetingAlgorithm?: TargetingAlgorithm;
    onDragStart?: (event: DragStartEvent) => void;
    onDragUpdate?: (event: DragUpdateEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    onDrop?: (event: DropEvent) => void;
};

type StartDragInput = {
    itemId: string;
    pointerPosition: Point;
    sourceRect: Rect;
};

export type DragStartEvent = {
    itemId: string;
    pointerPosition: Point;
    sourceRect: Rect;
};

export type DragUpdateEvent = {
    itemId: string;
    pointerPosition: Point;
    activeDropTarget: string | null;
    previousDropTarget: string | null;
};

export type DragEndEvent = {
    itemId: string;
    dropTarget: string | null;
};

export type DropEvent = {
    itemId: string;
    dropTarget: string;
};

export type DragRuntimeSubscription = {
    onDragStart?: (event: DragStartEvent) => void;
    onDragUpdate?: (event: DragUpdateEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    onDrop?: (event: DropEvent) => void;
};

export class DragRuntime {
    isDragging = false;
    draggedId: string | null = null;
    pointerPosition: Point | null = null;
    dropTargets = new Map<string, Rect>();
    activeDropTarget: string | null = null;

    private dragState: DragState | null = null;
    private cleanupWindowListeners: (() => void) | null = null;
    private cleanupTextSelectionSuppression: (() => void) | null = null;
    private subscriptions = new Set<DragRuntimeSubscription>();
    private lifecycleCallbacks: DragRuntimeSubscription = {};

    constructor(
      private setDragState: (dragState: DragState | null) => void,
      private targetingAlgorithm: TargetingAlgorithm = pointerToCenter,
      private hasDragOverlay = false,
    ) {}

    configure(input: {
      targetingAlgorithm: TargetingAlgorithm;
      hasDragOverlay: boolean;
      lifecycleCallbacks: DragRuntimeSubscription;
    }): void {
      this.hasDragOverlay = input.hasDragOverlay;
      this.targetingAlgorithm = input.targetingAlgorithm;
      this.lifecycleCallbacks = input.lifecycleCallbacks;
    }

    startDrag(input: StartDragInput): void {
        if (this.targetingAlgorithm.mode === "rect" && !this.hasDragOverlay) {
            throw new Error(
                "The selected targeting algorithm requires a drag overlay. Provide dragOverlay or use a pointer-based targeting algorithm.",
            );
        }

        this.isDragging = true;
        this.draggedId = input.itemId;
        this.pointerPosition = input.pointerPosition;
        this.activeDropTarget = null;

        this.dragState = {
            itemId: input.itemId,
            sourceRect: input.sourceRect,
            startPointerPosition: input.pointerPosition,
            pointerPosition: input.pointerPosition,
        };

        this.setDragState(this.dragState);
        this.suppressTextSelection();
        this.bindWindowListeners();
        this.notifyDragStart({
            itemId: input.itemId,
            pointerPosition: input.pointerPosition,
            sourceRect: input.sourceRect,
        });
    }

    updatePointer(pointerPosition: Point): void {
      if (!this.isDragging || !this.dragState) return;

      const itemId = this.dragState.itemId;
      const previousDropTarget = this.activeDropTarget;

      this.pointerPosition = pointerPosition;
      this.activeDropTarget = this.getActiveDropTarget(pointerPosition);
      this.dragState = {
        ...this.dragState,
        pointerPosition,
      };

      this.setDragState(this.dragState);
      this.notifyDragUpdate({
        itemId,
        pointerPosition,
        activeDropTarget: this.activeDropTarget,
        previousDropTarget,
      });
    }

    endDrag(): void {
      const itemId = this.draggedId;
      const dropTarget = this.activeDropTarget;

      this.isDragging = false;
      this.draggedId = null;
      this.pointerPosition = null;
      this.activeDropTarget = null;
      this.dragState = null;

      this.cleanupWindowListeners?.();
      this.cleanupWindowListeners = null;
      this.cleanupTextSelectionSuppression?.();
      this.cleanupTextSelectionSuppression = null;
      this.setDragState(null);

      if (itemId) {
        this.notifyDragEnd({
          itemId,
          dropTarget,
        });

        if (dropTarget) {
          this.notifyDrop({
            itemId,
            dropTarget,
          });
        }
      }
    }

    registerDropTarget(id: string, rect: Rect): void {
      this.dropTargets.set(id, rect);
    }

    unregisterDropTarget(id: string): void {
      this.dropTargets.delete(id);
    }

    subscribe(subscription: DragRuntimeSubscription): () => void {
      this.subscriptions.add(subscription);

      return () => {
        this.subscriptions.delete(subscription);
      };
    }

    private bindWindowListeners(): void {
      this.cleanupWindowListeners?.();

      const handlePointerMove = (event: PointerEvent) => {
        this.updatePointer({
          x: event.clientX,
          y: event.clientY,
        });
      };

      const handlePointerEnd = () => {
        this.endDrag();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);

      this.cleanupWindowListeners = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
      };
    }

    private suppressTextSelection(): void {
      this.cleanupTextSelectionSuppression?.();

      const root = document.documentElement;
      const body = document.body;
      const previousRootUserSelect = root.style.userSelect;
      const previousBodyUserSelect = body.style.userSelect;

      root.style.userSelect = "none";
      body.style.userSelect = "none";

      this.cleanupTextSelectionSuppression = () => {
        root.style.userSelect = previousRootUserSelect;
        body.style.userSelect = previousBodyUserSelect;
      };
    }

    private getActiveDropTarget(pointerPosition: Point): string | null {
      const activeTarget = this.targetingAlgorithm({
        pointerPosition,
        overlayRect: this.hasDragOverlay
          ? this.getCurrentDragRect(pointerPosition)
          : null,
        dropTargets: this.getAvailableDropTargets(),
      });

      return activeTarget?.dropTargetKey ?? null;
    }

    private getAvailableDropTargets(): DropTarget[] {
      const dropTargets: DropTarget[] = [];

      for (const [dropTargetKey, dropTargetRect] of this.dropTargets) {
        dropTargets.push({
          dropTargetKey,
          dropTargetRect,
        });
      }

      return dropTargets;
    }

    private getCurrentDragRect(pointerPosition: Point): DragRect | null {
      if (!this.dragState) {
        return null;
      }

      const deltaX = pointerPosition.x - this.dragState.startPointerPosition.x;
      const deltaY = pointerPosition.y - this.dragState.startPointerPosition.y;

      return translateRect(this.dragState.sourceRect, deltaX, deltaY);
    }

    private notifyDragStart(event: DragStartEvent): void {
      this.lifecycleCallbacks.onDragStart?.(event);

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragStart?.(event);
      }
    }

    private notifyDragUpdate(event: DragUpdateEvent): void {
      this.lifecycleCallbacks.onDragUpdate?.(event);

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragUpdate?.(event);
      }
    }

    private notifyDragEnd(event: DragEndEvent): void {
      this.lifecycleCallbacks.onDragEnd?.(event);

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragEnd?.(event);
      }
    }

    private notifyDrop(event: DropEvent): void {
      this.lifecycleCallbacks.onDrop?.(event);

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDrop?.(event);
      }
    }

}

export const DragContext = createContext<DragRuntime | null>(null);

export function DragProvider({
    children,
    dragOverlay,
    targetingAlgorithm = pointerToCenter,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onDrop,
}: DragProviderProps) {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const runtimeRef = useRef<DragRuntime | null>(null);

    if (runtimeRef.current === null) {
      runtimeRef.current = new DragRuntime(
        setDragState,
        targetingAlgorithm,
        dragOverlay !== undefined,
      );
    }

    runtimeRef.current.configure({
      targetingAlgorithm,
      hasDragOverlay: dragOverlay !== undefined,
      lifecycleCallbacks: {
        onDragStart,
        onDragUpdate,
        onDragEnd,
        onDrop,
      },
    });

    return (
      <DragContext value={runtimeRef.current}>
        {children}
        {dragOverlay && dragState ? (
          <DragOverlay dragState={dragState}>
            {dragOverlay(dragState)}
          </DragOverlay>
        ) : null}
      </DragContext>
    );
}

function translateRect(rect: DragRect, deltaX: number, deltaY: number): DragRect {
  return {
    x: rect.x + deltaX,
    y: rect.y + deltaY,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    left: rect.left + deltaX,
    width: rect.width,
    height: rect.height,
  };
}

function DragOverlay({
    dragState,
    children,
}: {
    dragState: DragState;
    children: ReactNode;
}) {
    const x = dragState.pointerPosition.x - dragState.startPointerPosition.x;
    const y = dragState.pointerPosition.y - dragState.startPointerPosition.y;

    return (
      <div
        style={{
          position: "fixed",
          left: dragState.sourceRect.left,
          top: dragState.sourceRect.top,
          width: dragState.sourceRect.width,
          height: dragState.sourceRect.height,
          pointerEvents: "auto",
          zIndex: 9999,
          transform: `translate3d(${x}px, ${y}px, 0)`,
        }}
      >
        {children}
      </div>
    );
}

