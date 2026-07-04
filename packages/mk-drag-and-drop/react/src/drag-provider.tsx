import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  DragRuntime,
  pointerToCenter,
  type DragEndEvent,
  type DragLifecycleCallbacks,
  type DragModifierInput,
  type DragOverlayRenderState,
  type DragRect,
  type DragStartEvent,
  type DragUpdateEvent,
  type DropEvent,
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
  type ReactRestrictToContainerInput,
} from "./modifiers/index.js";
export type { DragOverlayInput } from "./drag-overlay.js";
export type {
  DragEndEvent,
  DragLifecycleHelpers,
  DragModifier,
  DragModifierInput,
  DragModifierSetupInput,
  DragModifierTransformInput,
  DragOverlayPhase,
  DragRuntimeSubscription,
  DragStartEvent,
  DragState,
  DragUpdateEvent,
  DropPlacement,
  DropEvent,
  KeyboardCommand,
  KeyboardConfiguration,
  Point,
  PointerConfiguration,
  RemeasureDropTargetsInput,
  SortablePlacement,
} from "@mk-drag-and-drop/dom";

export type DragAnnouncements = {
  onDragStart?: (event: DragStartEvent) => string | null;
  onDragUpdate?: (event: DragUpdateEvent) => string | null;
  onDragEnd?: (event: DragEndEvent) => string | null;
  onDrop?: (event: DropEvent) => string | null;
};

type DragProviderProps = {
  children: ReactNode;
  announcements?: DragAnnouncements;
  dragOverlay?: (overlay: DragOverlayInput) => ReactNode;
  keyboardConfiguration?: KeyboardConfiguration;
  keepOverlayOnDrop?: boolean;
  modifiers?: readonly DragModifierInput[];
  pointerConfiguration?: PointerConfiguration;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
} & DragLifecycleCallbacks;

const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function DragProvider({
  children,
  announcements,
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
  const [announcementState, setAnnouncementState] = useState({
    id: 0,
    message: "",
  });
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
      onDragStart: (event, helpers) => {
        onDragStart?.(event, helpers);
        announce(announcements?.onDragStart?.(event));
      },
      onDragUpdate: (event, helpers) => {
        onDragUpdate?.(event, helpers);
        announce(announcements?.onDragUpdate?.(event));
      },
      onDragEnd: (event, helpers) => {
        onDragEnd?.(event, helpers);
        announce(announcements?.onDragEnd?.(event));
      },
      onDrop: (event, helpers) => {
        onDrop?.(event, helpers);
        announce(announcements?.onDrop?.(event));
      },
    },
    keyboardConfiguration,
    modifiers,
    pointerConfiguration,
  });

  useEffect(() => {
    const runtime = runtimeRef.current;

    return () => {
      runtime?.dispose();
    };
  }, []);

  function announce(message: string | null | undefined): void {
    if (message === undefined || message === null) {
      return;
    }

    setAnnouncementState((currentAnnouncementState) => ({
      id: currentAnnouncementState.id + 1,
      message,
    }));
  }

  function finishOverlay(): void {
    setOverlayState(null);
  }

  const handleOverlayRectChange = useCallback(
    (overlayRect: DragRect | null): void => {
      runtimeRef.current?.setOverlayRect(overlayRect);
    },
    [],
  );

  return (
    <DragContext value={runtimeRef.current}>
      {children}
      {dragOverlay && overlayState ? (
        <DragOverlay
          dragState={overlayState.dragState}
          onOverlayRectChange={handleOverlayRectChange}
        >
          {dragOverlay({
            dragState: overlayState.dragState,
            phase: overlayState.phase,
            finish: finishOverlay,
          })}
        </DragOverlay>
      ) : null}
      {announcements ? (
        <div
          aria-atomic="true"
          aria-live="polite"
          style={visuallyHiddenStyle}
        >
          {announcementState.message ? (
            <span key={announcementState.id}>
              {announcementState.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </DragContext>
  );
}
