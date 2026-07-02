import { createContext, useRef, useState, type ReactNode } from "react";

import {
  pointerToCenter,
  type DragRect,
  type DropTarget,
  type TargetingAlgorithm,
} from "@mk-drag-and-drop/core";

type Rect = DragRect;
type DragGroup = string;

type DropTargetRegistration = {
    element: HTMLElement;
    group: DragGroup;
};

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

export type DragOverlayPhase = "dragging" | "released";

export type DragOverlayInput = {
    phase: DragOverlayPhase;
    finish: () => void;
};

type DragOverlayRenderState = {
    dragState: DragState;
    phase: DragOverlayPhase;
};

type DragProviderProps = {
    children: ReactNode;
    dragOverlay?: (overlay: DragOverlayInput) => ReactNode;
    keepOverlayOnDrop?: boolean;
    targetingAlgorithm?: TargetingAlgorithm;
} & DragProviderLifecycleCallbacks;

type StartDragInput = {
    itemId: string;
    group: DragGroup;
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

export type SortablePlacement = {
    itemId: string;
    previousItemId: string | null;
    nextItemId: string | null;
};

export type DragLifecycleHelpers = {
    getSortablePlacement: (itemId: string) => SortablePlacement | null;
    getDropTargetRect: (dropTargetId: string) => DragRect | null;
};

type DragProviderLifecycleCallbacks = {
    onDragStart?: (
        event: DragStartEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDragUpdate?: (
        event: DragUpdateEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDragEnd?: (
        event: DragEndEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDrop?: (event: DropEvent, helpers: DragLifecycleHelpers) => void;
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
    draggedGroup: DragGroup | null = null;
    pointerPosition: Point | null = null;
    dropTargets = new Map<string, DropTargetRegistration>();
    activeDropTarget: string | null = null;

    private dragState: DragState | null = null;
    private cleanupWindowListeners: (() => void) | null = null;
    private cleanupTextSelectionSuppression: (() => void) | null = null;
    private subscriptions = new Set<DragRuntimeSubscription>();
    private lifecycleCallbacks: DragProviderLifecycleCallbacks = {};
    private dropTargetElements = new WeakMap<HTMLElement, string>();

    constructor(
      private setOverlayState: (
        overlayState: DragOverlayRenderState | null,
      ) => void,
      private targetingAlgorithm: TargetingAlgorithm = pointerToCenter,
      private hasDragOverlay = false,
      private keepOverlayOnDrop = false,
    ) {}

    configure(input: {
      targetingAlgorithm: TargetingAlgorithm;
      hasDragOverlay: boolean;
      keepOverlayOnDrop: boolean;
      lifecycleCallbacks: DragProviderLifecycleCallbacks;
    }): void {
      this.hasDragOverlay = input.hasDragOverlay;
      this.keepOverlayOnDrop = input.keepOverlayOnDrop;
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
        this.draggedGroup = input.group;
        this.pointerPosition = input.pointerPosition;
        this.activeDropTarget = null;

        this.dragState = {
            itemId: input.itemId,
            sourceRect: input.sourceRect,
            startPointerPosition: input.pointerPosition,
            pointerPosition: input.pointerPosition,
        };

        this.setOverlayState({
          dragState: this.dragState,
          phase: "dragging",
        });
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

      this.setOverlayState({
        dragState: this.dragState,
        phase: "dragging",
      });
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
      const releasedDragState = this.dragState;

      this.isDragging = false;
      this.draggedId = null;
      this.draggedGroup = null;
      this.pointerPosition = null;
      this.activeDropTarget = null;
      this.dragState = null;

      this.cleanupWindowListeners?.();
      this.cleanupWindowListeners = null;
      this.cleanupTextSelectionSuppression?.();
      this.cleanupTextSelectionSuppression = null;

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

      if (this.keepOverlayOnDrop && releasedDragState && this.hasDragOverlay) {
        this.setOverlayState({
          dragState: releasedDragState,
          phase: "released",
        });
      } else {
        this.setOverlayState(null);
      }
    }

    registerDropTarget(
      id: string,
      element: HTMLElement,
      group: DragGroup,
    ): void {
      const previousTarget = this.dropTargets.get(id);

      if (previousTarget && previousTarget.element !== element) {
        this.dropTargetElements.delete(previousTarget.element);
      }

      this.dropTargets.set(id, { element, group });
      this.dropTargetElements.set(element, id);
    }

    unregisterDropTarget(id: string): void {
      const target = this.dropTargets.get(id);

      if (target) {
        this.dropTargetElements.delete(target.element);
      }

      this.dropTargets.delete(id);
    }

    getSortablePlacement(itemId: string): SortablePlacement | null {
      const registration = this.dropTargets.get(itemId);

      if (!registration?.element.parentElement) {
        return null;
      }

      const { element, group } = registration;

      return {
        itemId,
        previousItemId: this.getNearestSortableSiblingItemId(
          element.previousElementSibling,
          group,
          "previous",
        ),
        nextItemId: this.getNearestSortableSiblingItemId(
          element.nextElementSibling,
          group,
          "next",
        ),
      };
    }

    getDropTargetRect(dropTargetId: string): DragRect | null {
      const registration = this.dropTargets.get(dropTargetId);

      return registration
        ? domRectToDragRect(registration.element.getBoundingClientRect())
        : null;
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

      if (this.draggedGroup === null) {
        return dropTargets;
      }

      for (const [dropTargetKey, dropTarget] of this.dropTargets) {
        if (dropTarget.group !== this.draggedGroup) {
          continue;
        }

        dropTargets.push({
          dropTargetKey,
          dropTargetRect: domRectToDragRect(
            dropTarget.element.getBoundingClientRect(),
          ),
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

    private getNearestSortableSiblingItemId(
      element: Element | null,
      group: DragGroup,
      direction: "previous" | "next",
    ): string | null {
      let currentElement = element;

      while (currentElement) {
        const itemId = this.getSortableItemId(currentElement, group);

        if (itemId) {
          return itemId;
        }

        currentElement =
          direction === "previous"
            ? currentElement.previousElementSibling
            : currentElement.nextElementSibling;
      }

      return null;
    }

    private getSortableItemId(element: Element, group: DragGroup): string | null {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const itemId = this.dropTargetElements.get(element);
      const registration = itemId ? this.dropTargets.get(itemId) : null;

      if (!registration || registration.group !== group) {
        return null;
      }

      return itemId ?? null;
    }

    private createLifecycleHelpers(): DragLifecycleHelpers {
      return {
        getSortablePlacement: (itemId) => this.getSortablePlacement(itemId),
        getDropTargetRect: (dropTargetId) =>
          this.getDropTargetRect(dropTargetId),
      };
    }

    private notifyDragStart(event: DragStartEvent): void {
      this.lifecycleCallbacks.onDragStart?.(
        event,
        this.createLifecycleHelpers(),
      );

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragStart?.(event);
      }
    }

    private notifyDragUpdate(event: DragUpdateEvent): void {
      this.lifecycleCallbacks.onDragUpdate?.(
        event,
        this.createLifecycleHelpers(),
      );

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragUpdate?.(event);
      }
    }

    private notifyDragEnd(event: DragEndEvent): void {
      this.lifecycleCallbacks.onDragEnd?.(
        event,
        this.createLifecycleHelpers(),
      );

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDragEnd?.(event);
      }
    }

    private notifyDrop(event: DropEvent): void {
      this.lifecycleCallbacks.onDrop?.(event, this.createLifecycleHelpers());

      for (const subscription of Array.from(this.subscriptions)) {
        subscription.onDrop?.(event);
      }
    }

}

export const DragContext = createContext<DragRuntime | null>(null);

export function DragProvider({
    children,
    dragOverlay,
    keepOverlayOnDrop = false,
    targetingAlgorithm = pointerToCenter,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onDrop,
}: DragProviderProps) {
    const [overlayState, setOverlayState] =
      useState<DragOverlayRenderState | null>(null);
    const runtimeRef = useRef<DragRuntime | null>(null);

    if (runtimeRef.current === null) {
      runtimeRef.current = new DragRuntime(
        setOverlayState,
        targetingAlgorithm,
        dragOverlay !== undefined,
        keepOverlayOnDrop,
      );
    }

    runtimeRef.current.configure({
      targetingAlgorithm,
      hasDragOverlay: dragOverlay !== undefined,
      keepOverlayOnDrop,
      lifecycleCallbacks: {
        onDragStart,
        onDragUpdate,
        onDragEnd,
        onDrop,
      },
    });

    function finishOverlay(): void {
      setOverlayState(null);
    }

    return (
      <DragContext value={runtimeRef.current}>
        {children}
        {dragOverlay && overlayState ? (
          <DragOverlay dragState={overlayState.dragState}>
            {dragOverlay({
              phase: overlayState.phase,
              finish: finishOverlay,
            })}
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

function domRectToDragRect(rect: DOMRect): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
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

