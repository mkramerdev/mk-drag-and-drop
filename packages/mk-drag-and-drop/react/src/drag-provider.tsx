import {
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DragRuntime,
  pointerToCenter,
  type DragLifecycleCallbacks,
  type DragModifier,
  type DragOverlayRenderState,
  type KeyboardConfiguration,
  type PointerConfiguration,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "@mk-drag-and-drop/dom";

import { DragContext } from "./drag-context.js";
import {
  DragOverlay,
  type DragOverlayInput,
} from "./drag-overlay.js";

export { DragContext } from "./drag-context.js";
export { useRemeasureDropTargets } from "./hooks/use-remeasure-drop-targets.js";
export {
  lockToXAxis,
  lockToYAxis,
  restrictToContainer,
} from "./modifiers/index.js";
export type { DragOverlayInput } from "./drag-overlay.js";
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
