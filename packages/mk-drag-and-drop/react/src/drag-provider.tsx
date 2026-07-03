import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  pointerToCenter,
  type DragRect,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "@mk-drag-and-drop/core";
import {
  DragRuntime,
  lockToXAxis as domLockToXAxis,
  lockToYAxis as domLockToYAxis,
  restrictToContainer as domRestrictToContainer,
  type DragLifecycleCallbacks,
  type DragModifier,
  type DragOverlayPhase,
  type DragOverlayRenderState,
  type DragState,
  type KeyboardConfiguration,
  type PointerConfiguration,
  type RemeasureDropTargetsInput,
} from "@mk-drag-and-drop/dom";

export type {
  DragEndEvent,
  DragLifecycleHelpers,
  DragModifier,
  DragModifierSetupInput,
  DragModifierTransformInput,
  DragOverlayPhase,
  DragRuntimeSubscription,
  DragStartEvent,
  DragState,
  DragUpdateEvent,
  DropEvent,
  KeyboardCommand,
  KeyboardConfiguration,
  Point,
  PointerConfiguration,
  RemeasureDropTargetsInput,
  SortablePlacement,
} from "@mk-drag-and-drop/dom";

export type DragOverlayInput = {
  phase: DragOverlayPhase;
  finish: () => void;
};

type DragProviderProps = {
  children: ReactNode;
  dragOverlay?: (overlay: DragOverlayInput) => ReactNode;
  keyboardConfiguration?: KeyboardConfiguration;
  keepOverlayOnDrop?: boolean;
  modifiers?: readonly DragModifier<any>[];
  pointerConfiguration?: PointerConfiguration;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
} & DragLifecycleCallbacks;

export const DragContext = createContext<unknown | null>(null);

export function useRemeasureDropTargets(): (
  input?: RemeasureDropTargetsInput,
) => void {
  const runtime = useContext(DragContext) as DragRuntime | null;

  if (!runtime) {
    throw new Error("useRemeasureDropTargets must be used inside DragProvider");
  }

  return useCallback(
    (input?: RemeasureDropTargetsInput) => {
      runtime.remeasureDropTargets(input);
    },
    [runtime],
  );
}

export function DragProvider({
  children,
  dragOverlay,
  keyboardConfiguration,
  keepOverlayOnDrop = false,
  modifiers,
  pointerConfiguration,
  targetingAlgorithm = pointerToCenter,
  targetingConstraint,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDrop,
}: DragProviderProps) {
  const [overlayState, setOverlayState] =
    useState<DragOverlayRenderState | null>(null);
  const runtimeRef = useRef<DragRuntime | null>(null);

  if (runtimeRef.current === null) {
    runtimeRef.current = new DragRuntime({
      setOverlayState,
      targetingAlgorithm,
      hasDragOverlay: dragOverlay !== undefined,
      keepOverlayOnDrop,
      targetingConstraint,
    });
  }

  runtimeRef.current.configure({
    targetingAlgorithm,
    targetingConstraint,
    hasDragOverlay: dragOverlay !== undefined,
    keepOverlayOnDrop,
    lifecycleCallbacks: {
      onDragStart,
      onDragUpdate,
      onDragEnd,
      onDrop,
    },
    keyboardConfiguration,
    modifiers,
    pointerConfiguration,
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

export function lockToXAxis(): DragModifier {
  return domLockToXAxis();
}

export function lockToYAxis(): DragModifier {
  return domLockToYAxis();
}

export function restrictToContainer(
  containerRef: RefObject<HTMLElement | null>,
): DragModifier<DragRect | null> {
  return domRestrictToContainer(() => containerRef.current);
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
