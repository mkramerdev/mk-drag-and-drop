import type {
  DragRect,
  DragPoint,
  DropTarget,
  TargetingAlgorithm,
  TargetingConstraint,
} from "@mk-drag-and-drop/core";
import {
  endDomDragRuntime,
  moveDomDragRuntime,
  setDomActiveDropTarget,
} from "./dom-drag-runtime.js";
import { getDomDropTargets } from "./dom-drop-target.js";
import type {
  DomDragControls,
  DomDragEndEvent,
  DomDropEvent,
  DomDragRuntime,
  DomDragSession,
  DomDragStartEvent,
  DomDragUpdateEvent,
} from "./types.js";

export type DomPointerCapture = {
  element: HTMLElement;
  pointerId: number;
  previousCursor: string;
};

export type TrackDomDragInput = {
  runtime: DomDragRuntime;
  session: DomDragSession;
  dropTargetParent: ParentNode;
  pointerCapture: DomPointerCapture;
  targetingAlgorithm: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
  onDragStart?: (drag: DomDragStartEvent, controls: DomDragControls) => void;
  onDragUpdate?: (drag: DomDragUpdateEvent, controls: DomDragControls) => void;
  onDragEnd?: (drag: DomDragEndEvent, controls: DomDragControls) => void;
  onDrop?: (drop: DomDropEvent, controls: DomDragControls) => void;
};

type TargetRecalculation = {
  activeDropTargetKey: string | null;
  previousDropTargetKey: string | null;
};

type CurrentDragUpdateEventRef = {
  current: DomDragUpdateEvent | null;
};

export function createDomDragSession(): DomDragSession {
  return {
    dropTargets: new Map(),
    activeDropTargetKey: null,
    requestDropTargetRetarget: null,
  };
}

export function trackDomDrag(input: TrackDomDragInput): void {
  if (!input.runtime.isDragging) {
    return;
  }

  document.documentElement.dataset.dndDragging = "true";
  input.session.activeDropTargetKey = null;

  let pendingPointerMove: PointerEvent | null = null;
  let pointerMoveFrameId: number | null = null;
  let isDropTargetRetargetPending = false;
  let isProcessingPointerMoveFrame = false;
  let isDragSessionActive = true;
  let latestOverlayRect: DragRect | null = null;
  const currentDragUpdateEventRef: CurrentDragUpdateEventRef = {
    current: null,
  };

  const syncCurrentActiveDropTarget = () => {
    syncActiveDropTarget({
      parent: input.dropTargetParent,
      session: input.session,
      nextDropTargetKey: input.runtime.activeDropTargetKey,
    });
  };
  const retargetFromSession = (options?: {
    overlayRect?: DragRect | null;
  }): TargetRecalculation => {
    const previousDropTargetKey = input.runtime.activeDropTargetKey;

    if (!isDragSessionActive || !input.runtime.isDragging) {
      return {
        activeDropTargetKey: previousDropTargetKey,
        previousDropTargetKey,
      };
    }

    retargetDrag(input, {
      dropTargets: getDomDropTargets(input.session),
      overlayRect: options?.overlayRect ?? null,
    });
    syncCurrentActiveDropTarget();

    return {
      activeDropTargetKey: input.runtime.activeDropTargetKey,
      previousDropTargetKey,
    };
  };
  const recalculateTargets = (
    overlayRect?: DragRect | null,
  ): void => {
    if (overlayRect !== undefined) {
      latestOverlayRect = overlayRect;
    }

    cancelPendingDropTargetRetarget();

    const recalculation = retargetFromSession({
      overlayRect:
        input.targetingAlgorithm.mode === "rect" ? latestOverlayRect : null,
    });

    if (currentDragUpdateEventRef.current) {
      currentDragUpdateEventRef.current.activeDropTargetKey =
        recalculation.activeDropTargetKey;
      currentDragUpdateEventRef.current.previousDropTargetKey =
        recalculation.previousDropTargetKey;
    }
  };
  const controls: DomDragControls = {
    get pointerPosition() {
      return input.runtime.pointerPosition;
    },
    recalculateTargets,
  };
  const requestDropTargetRetarget = () => {
    if (!isDragSessionActive || !input.runtime.isDragging) {
      return;
    }

    isDropTargetRetargetPending = true;

    if (isProcessingPointerMoveFrame) {
      return;
    }

    flushPendingDropTargetRetarget();
  };
  const flushPendingDropTargetRetarget = (): boolean => {
    if (!isDropTargetRetargetPending) {
      return false;
    }

    isDropTargetRetargetPending = false;

    retargetFromSession({
      overlayRect:
        input.targetingAlgorithm.mode === "rect" ? latestOverlayRect : null,
    });

    return true;
  };

  input.session.requestDropTargetRetarget = requestDropTargetRetarget;
  emitDragStart(input, controls);

  const handlePointerMove = (event: PointerEvent) => {
    pendingPointerMove = event;

    if (pointerMoveFrameId !== null) {
      return;
    }

    pointerMoveFrameId = window.requestAnimationFrame(() => {
      pointerMoveFrameId = null;

      const latestPointerMove = pendingPointerMove;
      pendingPointerMove = null;

      if (!latestPointerMove || !input.runtime.isDragging) {
        return;
      }

      isProcessingPointerMoveFrame = true;

      try {
        const previousDropTargetKey = input.runtime.activeDropTargetKey;

        onPointerMove(input, latestPointerMove);
        if (input.targetingAlgorithm.mode === "pointer") {
          syncCurrentActiveDropTarget();
        }
        emitDragUpdate(
          input,
          previousDropTargetKey,
          controls,
          currentDragUpdateEventRef,
        );

        if (isDropTargetRetargetPending) {
          flushPendingDropTargetRetarget();
        }
      } finally {
        isProcessingPointerMoveFrame = false;
      }
    });
  };

  const handlePointerEnd = () => {
    if (!input.runtime.isDragging) {
      return;
    }

    if (!flushPendingDropTargetRetarget()) {
      retargetFromSession({
        overlayRect:
          input.targetingAlgorithm.mode === "rect" ? latestOverlayRect : null,
      });
    }

    releaseDrag();
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  function releaseDrag(): void {
    removeListeners();
    isDragSessionActive = false;
    cancelPendingDropTargetRetarget();
    input.session.requestDropTargetRetarget = null;

    releaseDomDrag(input, controls);
  }

  function removeListeners(): void {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
    releasePointerCapture(input.pointerCapture);

    if (pointerMoveFrameId !== null) {
      window.cancelAnimationFrame(pointerMoveFrameId);
      pointerMoveFrameId = null;
    }

    pendingPointerMove = null;
  }

  function cancelPendingDropTargetRetarget(): void {
    isDropTargetRetargetPending = false;
  }
}

function onPointerMove(
  input: TrackDomDragInput,
  event: PointerEvent,
): void {
  if (!input.runtime.isDragging) {
    return;
  }

  moveDomDragRuntime(input.runtime, {
    pointerPosition: {
      x: event.clientX,
      y: event.clientY,
    },
  });

  if (input.targetingAlgorithm.mode === "pointer") {
    retargetDrag(input, {
      dropTargets: getDomDropTargets(input.session),
      overlayRect: null,
    });
  }
}

function retargetDrag(
  input: TrackDomDragInput,
  targetingInput: {
    dropTargets: readonly DropTarget[];
    overlayRect: DragRect | null;
  },
): void {
  const pointerPosition = input.runtime.pointerPosition;

  if (!pointerPosition) {
    return;
  }

  const activeDropTarget = input.targetingAlgorithm({
    pointerPosition,
    overlayRect: targetingInput.overlayRect,
    dropTargets: getConstrainedDropTargets(input, {
      pointerPosition,
      overlayRect: targetingInput.overlayRect,
      dropTargets: targetingInput.dropTargets,
    }),
  });

  setDomActiveDropTarget(input.runtime, {
    dropTargetKey: activeDropTarget?.dropTargetKey ?? null,
  });
}

function getConstrainedDropTargets(
  input: TrackDomDragInput,
  targetingInput: {
    pointerPosition: DragPoint;
    overlayRect: DragRect | null;
    dropTargets: readonly DropTarget[];
  },
): readonly DropTarget[] {
  if (!input.targetingConstraint) {
    return targetingInput.dropTargets;
  }

  return targetingInput.dropTargets.filter((dropTarget) =>
    input.targetingConstraint?.({
      pointerPosition: targetingInput.pointerPosition,
      overlayRect: targetingInput.overlayRect,
      dropTarget,
    }),
  );
}

function emitDragUpdate(
  input: TrackDomDragInput,
  previousDropTargetKey: string | null,
  controls: DomDragControls,
  currentDragUpdateEventRef: CurrentDragUpdateEventRef,
): void {
  const draggedKey = input.runtime.draggedKey;
  const pointerPosition = input.runtime.pointerPosition;

  if (draggedKey === null || pointerPosition === null) {
    return;
  }

  const dragUpdate: DomDragUpdateEvent = {
    draggedKey,
    pointerPosition,
    activeDropTargetKey: input.runtime.activeDropTargetKey,
    previousDropTargetKey,
  };

  currentDragUpdateEventRef.current = dragUpdate;

  try {
    input.onDragUpdate?.(dragUpdate, controls);
  } finally {
    currentDragUpdateEventRef.current = null;
  }
}

function emitDragStart(
  input: TrackDomDragInput,
  controls: DomDragControls,
): void {
  const draggedKey = input.runtime.draggedKey;

  if (draggedKey === null) {
    return;
  }

  input.onDragStart?.(
    {
      draggedKey,
    },
    controls,
  );
}

function releaseDomDrag(
  input: TrackDomDragInput,
  controls: DomDragControls,
): void {
  const draggedKey = input.runtime.draggedKey;
  const dropTargetKey = input.runtime.activeDropTargetKey;
  const drop =
    draggedKey !== null && dropTargetKey !== null
      ? {
          draggedKey,
          dropTargetKey,
        }
      : null;

  delete document.documentElement.dataset.dndDragging;
  clearActiveDropTarget(
    input.session.activeDropTargetKey,
    input.dropTargetParent,
  );
  input.session.activeDropTargetKey = null;

  if (draggedKey !== null) {
    input.onDragEnd?.(
      {
        draggedKey,
        dropTargetKey,
      },
      controls,
    );
  }

  endDomDragRuntime(input.runtime);

  if (drop) {
    input.onDrop?.(drop, controls);
  }
}

function syncActiveDropTarget(input: {
  parent: ParentNode;
  session: DomDragSession;
  nextDropTargetKey: string | null;
}): void {
  const previousDropTargetKey = input.session.activeDropTargetKey;

  if (previousDropTargetKey === input.nextDropTargetKey) {
    return;
  }

  clearActiveDropTarget(previousDropTargetKey, input.parent);
  input.session.activeDropTargetKey = null;

  if (!input.nextDropTargetKey) {
    return;
  }

  const nextDropTarget = getDropTargetElement(
    input.nextDropTargetKey,
    input.parent,
  );

  if (!nextDropTarget) {
    return;
  }

  nextDropTarget.dataset.dndActiveDropTarget = "true";
  input.session.activeDropTargetKey = input.nextDropTargetKey;
}

function clearActiveDropTarget(
  dropTargetKey: string | null,
  parent: ParentNode,
): void {
  if (!dropTargetKey) {
    return;
  }

  const currentDropTarget = getDropTargetElement(dropTargetKey, parent);

  if (currentDropTarget) {
    delete currentDropTarget.dataset.dndActiveDropTarget;
  }
}

function releasePointerCapture(pointerCapture: DomPointerCapture): void {
  if (pointerCapture.element.hasPointerCapture(pointerCapture.pointerId)) {
    pointerCapture.element.releasePointerCapture(pointerCapture.pointerId);
  }

  pointerCapture.element.style.cursor = pointerCapture.previousCursor;
}

function getDropTargetElement(
  dropTargetKey: string,
  parent: ParentNode = document,
): HTMLElement | null {
  return parent.querySelector<HTMLElement>(
    `[data-dnd-drop-target-key="${CSS.escape(dropTargetKey)}"]`,
  );
}
