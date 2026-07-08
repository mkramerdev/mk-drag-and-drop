import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  pointerToCenter,
  type DragEndEvent,
  type DragLifecycleCallbacks,
  type DragModifierInput,
  type DragRect,
  type DragStartEvent,
  type DragUpdateEvent,
  type DropEvent,
  type KeyboardConfiguration,
  type OverlayReleaseMode,
  type PointerConfiguration,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "@mk-drag-and-drop/dom";
import {
  createDragRuntimeScope,
  type DragOverlayHostUpdate,
  type DragOverlayRenderState,
  type DragState,
  type DragRuntimeScope,
  type DragRuntimeScopeConfigureInput,
} from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "./drag-context.js";
import {
  DragOverlayHost,
  type DragOverlayHostHandle,
  type DragOverlayInput,
} from "./drag-overlay.js";

export type DragAnnouncements = {
  onDragStart?: (event: DragStartEvent) => string | null;
  onDragUpdate?: (event: DragUpdateEvent) => string | null;
  onDragEnd?: (event: DragEndEvent) => string | null;
  onDrop?: (event: DropEvent) => string | null;
};

export type DragProviderProps = {
  children: ReactNode;
  announcements?: DragAnnouncements;
  dragOverlay?: (overlay: DragOverlayInput) => ReactNode;
  keyboardConfiguration?: KeyboardConfiguration;
  modifiers?: readonly DragModifierInput[];
  overlayRelease?: OverlayReleaseMode;
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

type DragOverlaySnapshot = {
  id: number;
  state: DragOverlayRenderState;
  content: ReactNode;
};

type DragOverlayRequest = {
  id: number;
  state: DragOverlayRenderState;
};

type LatestLifecycleProps = Pick<
  DragProviderProps,
  "announcements" | "onDragStart" | "onDragUpdate" | "onDragEnd" | "onDrop"
>;

type RuntimeConfigurationSnapshot = Omit<
  DragRuntimeScopeConfigureInput,
  "lifecycleCallbacks"
>;

export function DragProvider({
  children,
  announcements,
  dragOverlay,
  keyboardConfiguration,
  modifiers,
  overlayRelease = "auto",
  pointerConfiguration,
  targetingAlgorithm = pointerToCenter,
  targetingConstraint,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDrop,
}: DragProviderProps) {
  const [overlayRequest, setOverlayRequest] =
    useState<DragOverlayRequest | null>(null);
  const [announcementState, setAnnouncementState] = useState({
    id: 0,
    message: "",
  });
  const lastAnnouncementRef = useRef<string | null>(null);
  const runtimeRef = useRef<DragRuntimeScope | null>(null);
  const dragOverlayRef = useRef(dragOverlay);
  const overlayHostRef = useRef<DragOverlayHostHandle | null>(null);
  const overlayContentIdRef = useRef(0);
  const overlaySnapshotRef = useRef<DragOverlaySnapshot | null>(null);
  const pendingOverlayDragStateRef = useRef<DragState | null>(null);
  const latestLifecyclePropsRef = useRef<LatestLifecycleProps>({
    announcements,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onDrop,
  });
  const lifecycleCallbacksRef = useRef<DragLifecycleCallbacks | null>(null);
  const runtimeConfigurationSnapshotRef =
    useRef<RuntimeConfigurationSnapshot | null>(null);
  const keyboardDragEnabled =
    isKeyboardDragEnabledFromConfiguration(keyboardConfiguration);

  const clearOverlayHost = useCallback((): void => {
    pendingOverlayDragStateRef.current = null;
    overlayHostRef.current = null;
    overlaySnapshotRef.current = null;
    setOverlayRequest(null);
    runtimeRef.current?.setOverlayRect(null);
  }, []);

  if (lifecycleCallbacksRef.current === null) {
    lifecycleCallbacksRef.current = {
      onDragStart: (event, helpers) => {
        const { announcements, onDragStart } =
          latestLifecyclePropsRef.current;

        onDragStart?.(event, helpers);
        announce(announcements?.onDragStart?.(event));
      },
      onDragUpdate: (event, helpers) => {
        const { announcements, onDragUpdate } =
          latestLifecyclePropsRef.current;

        onDragUpdate?.(event, helpers);

        if (event.activeDropTargetId !== event.previousDropTargetId) {
          announce(announcements?.onDragUpdate?.(event));
        }
      },
      onDragEnd: (event, helpers) => {
        const { announcements, onDragEnd } = latestLifecyclePropsRef.current;

        onDragEnd?.(event, helpers);
        announce(announcements?.onDragEnd?.(event));
      },
      onDrop: (event, helpers) => {
        const { announcements, onDrop } = latestLifecyclePropsRef.current;

        onDrop?.(event, helpers);
        announce(announcements?.onDrop?.(event));
      },
    };
  }

  if (runtimeRef.current === null) {
    runtimeRef.current = createDragRuntimeScope({
      updateOverlayHost: handleOverlayHostUpdate,
    });
  }

  const runtime = runtimeRef.current;
  const remeasureOverlay = useCallback((): void => {
    overlayHostRef.current?.remeasure();
  }, []);

  const contextValue = useMemo(
    () => ({
      runtime,
      keyboardDragEnabled,
      remeasureOverlay,
    }),
    [keyboardDragEnabled, remeasureOverlay, runtime],
  );

  useEffect(() => {
    return () => {
      runtime.releaseActiveDragResources();
    };
  }, [runtime]);

  const nextRuntimeConfiguration: DragRuntimeScopeConfigureInput = {
    targetingAlgorithm,
    targetingConstraint,
    hasDragOverlay: dragOverlay !== undefined,
    overlayRelease,
    lifecycleCallbacks: lifecycleCallbacksRef.current,
    keyboardConfiguration,
    modifiers,
    pointerConfiguration,
  };

  useLayoutEffect(() => {
    dragOverlayRef.current = dragOverlay;
    latestLifecyclePropsRef.current = {
      announcements,
      onDragStart,
      onDragUpdate,
      onDragEnd,
      onDrop,
    };
  });

  useLayoutEffect(() => {
    if (
      areRuntimeConfigurationSnapshotsEqual(
        runtimeConfigurationSnapshotRef.current,
        nextRuntimeConfiguration,
      )
    ) {
      return;
    }

    runtime.configure(nextRuntimeConfiguration);
    runtimeConfigurationSnapshotRef.current =
      createRuntimeConfigurationSnapshot(nextRuntimeConfiguration);
  });

  useEffect(() => {
    if (!dragOverlay) {
      clearOverlayHost();
    }
  }, [dragOverlay, clearOverlayHost]);

  useEffect(() => {
    if (!announcements) {
      lastAnnouncementRef.current = null;
    }
  }, [announcements]);

  function announce(message: string | null | undefined): void {
    if (!message || message === lastAnnouncementRef.current) {
      return;
    }

    lastAnnouncementRef.current = message;
    setAnnouncementState((currentAnnouncementState) => ({
      id: currentAnnouncementState.id + 1,
      message,
    }));
  }

  const handleOverlayRectChange = useCallback(
    (overlayRect: DragRect | null): void => {
      runtimeRef.current?.setOverlayRect(overlayRect);
    },
    [],
  );

  const handleOverlayHostReady = useCallback(
    (host: DragOverlayHostHandle | null): void => {
      overlayHostRef.current = host;

      if (host && pendingOverlayDragStateRef.current) {
        host.move(pendingOverlayDragStateRef.current);
      }
    },
    [],
  );
  const overlaySnapshot = getOverlaySnapshot();

  return (
    <DragContext value={contextValue}>
      {children}
      {overlaySnapshot ? (
        <DragOverlayHost
          contentId={overlaySnapshot.id}
          dragState={overlaySnapshot.state.dragState}
          onHostReady={handleOverlayHostReady}
          onOverlayRectChange={handleOverlayRectChange}
        >
          {overlaySnapshot.content}
        </DragOverlayHost>
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

  function handleOverlayHostUpdate(update: DragOverlayHostUpdate): void {
    if (update.type === "mount" || update.type === "release") {
      mountOverlay(update.state);
      return;
    }

    if (update.type === "move") {
      moveOverlay(update.dragState);
      return;
    }

    clearOverlayHost();
  }

  function mountOverlay(state: DragOverlayRenderState): void {
    pendingOverlayDragStateRef.current = state.dragState;
    overlayHostRef.current?.move(state.dragState);

    if (!dragOverlayRef.current) {
      clearOverlayHost();
      return;
    }

    overlayContentIdRef.current += 1;
    setOverlayRequest({
      id: overlayContentIdRef.current,
      state,
    });
  }

  function moveOverlay(dragState: DragState): void {
    pendingOverlayDragStateRef.current = dragState;
    overlayHostRef.current?.move(dragState);
  }

  function getOverlaySnapshot(): DragOverlaySnapshot | null {
    if (!overlayRequest || !dragOverlay) {
      overlaySnapshotRef.current = null;
      return null;
    }

    if (overlaySnapshotRef.current?.id === overlayRequest.id) {
      return overlaySnapshotRef.current;
    }

    overlaySnapshotRef.current = {
      id: overlayRequest.id,
      state: overlayRequest.state,
      content: dragOverlay(createOverlayInput(overlayRequest.state)),
    };

    return overlaySnapshotRef.current;
  }

  function createOverlayInput(
    overlayState: DragOverlayRenderState,
  ): DragOverlayInput {
    if (overlayState.phase === "released") {
      return {
        dragState: overlayState.dragState,
        phase: "released",
        remeasureOverlay,
        removeOverlay: clearOverlayHost,
      };
    }

    return {
      dragState: overlayState.dragState,
      phase: "dragging",
      remeasureOverlay,
    };
  }
}

function createRuntimeConfigurationSnapshot(
  input: DragRuntimeScopeConfigureInput,
): RuntimeConfigurationSnapshot {
  return {
    targetingAlgorithm: input.targetingAlgorithm,
    targetingConstraint: input.targetingConstraint,
    hasDragOverlay: input.hasDragOverlay,
    overlayRelease: input.overlayRelease,
    keyboardConfiguration: cloneKeyboardConfiguration(
      input.keyboardConfiguration,
    ),
    modifiers: input.modifiers ? Array.from(input.modifiers) : undefined,
    pointerConfiguration: input.pointerConfiguration
      ? { ...input.pointerConfiguration }
      : undefined,
  };
}

function areRuntimeConfigurationSnapshotsEqual(
  previous: RuntimeConfigurationSnapshot | null,
  next: DragRuntimeScopeConfigureInput,
): boolean {
  return (
    previous !== null &&
    previous.targetingAlgorithm === next.targetingAlgorithm &&
    previous.targetingConstraint === next.targetingConstraint &&
    previous.hasDragOverlay === next.hasDragOverlay &&
    previous.overlayRelease === next.overlayRelease &&
    areKeyboardConfigurationsEqual(
      previous.keyboardConfiguration,
      next.keyboardConfiguration,
    ) &&
    arePointerConfigurationsEqual(
      previous.pointerConfiguration,
      next.pointerConfiguration,
    ) &&
    areModifierInputsEqual(previous.modifiers, next.modifiers)
  );
}

function cloneKeyboardConfiguration(
  keyboardConfiguration: KeyboardConfiguration | undefined,
): KeyboardConfiguration | undefined {
  if (!keyboardConfiguration) {
    return undefined;
  }

  return {
    enabled: keyboardConfiguration.enabled,
    start: cloneKeyboardCommand(keyboardConfiguration.start),
    drop: cloneKeyboardCommand(keyboardConfiguration.drop),
    cancel: cloneKeyboardCommand(keyboardConfiguration.cancel),
    moveUp: cloneKeyboardCommand(keyboardConfiguration.moveUp),
    moveDown: cloneKeyboardCommand(keyboardConfiguration.moveDown),
    moveLeft: cloneKeyboardCommand(keyboardConfiguration.moveLeft),
    moveRight: cloneKeyboardCommand(keyboardConfiguration.moveRight),
    moveDistance: keyboardConfiguration.moveDistance,
  };
}

function cloneKeyboardCommand(
  command: KeyboardConfiguration["start"],
): KeyboardConfiguration["start"] {
  return Array.isArray(command) ? Array.from(command) : command;
}

function areKeyboardConfigurationsEqual(
  previous: KeyboardConfiguration | undefined,
  next: KeyboardConfiguration | undefined,
): boolean {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  return (
    previous.enabled === next.enabled &&
    previous.moveDistance === next.moveDistance &&
    areKeyboardCommandsEqual(previous.start, next.start) &&
    areKeyboardCommandsEqual(previous.drop, next.drop) &&
    areKeyboardCommandsEqual(previous.cancel, next.cancel) &&
    areKeyboardCommandsEqual(previous.moveUp, next.moveUp) &&
    areKeyboardCommandsEqual(previous.moveDown, next.moveDown) &&
    areKeyboardCommandsEqual(previous.moveLeft, next.moveLeft) &&
    areKeyboardCommandsEqual(previous.moveRight, next.moveRight)
  );
}

function areKeyboardCommandsEqual(
  previous: KeyboardConfiguration["start"],
  next: KeyboardConfiguration["start"],
): boolean {
  if (previous === next) {
    return true;
  }

  if (previous === undefined || next === undefined) {
    return false;
  }

  if (typeof previous === "string" || typeof next === "string") {
    return (
      typeof previous === "string" &&
      typeof next === "string" &&
      normalizeKeyboardKey(previous) === normalizeKeyboardKey(next)
    );
  }

  if (previous.length !== next.length) {
    return false;
  }

  return previous.every(
    (key, index) => normalizeKeyboardKey(key) === normalizeKeyboardKey(next[index]),
  );
}

function normalizeKeyboardKey(key: string): string {
  return key === " " ? "Space" : key;
}

function arePointerConfigurationsEqual(
  previous: PointerConfiguration | undefined,
  next: PointerConfiguration | undefined,
): boolean {
  return (
    previous === next ||
    (previous !== undefined &&
      next !== undefined &&
      previous.activationDelay === next.activationDelay &&
      previous.activationDistance === next.activationDistance)
  );
}

function areModifierInputsEqual(
  previous: readonly DragModifierInput[] | undefined,
  next: readonly DragModifierInput[] | undefined,
): boolean {
  if (previous === next) {
    return true;
  }

  if (!previous || !next || previous.length !== next.length) {
    return false;
  }

  return previous.every((modifier, index) => modifier === next[index]);
}

function isKeyboardDragEnabledFromConfiguration(
  keyboardConfiguration: KeyboardConfiguration | undefined,
): boolean {
  return keyboardConfiguration?.enabled ?? true;
}
