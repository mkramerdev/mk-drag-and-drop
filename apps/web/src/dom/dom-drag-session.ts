import type { DropTarget, DragRuntime, TargetingAlgorithm } from "../core";
import { endDrag, moveDrag, setActiveDropTarget } from "../core";
import {
  activateDomDragController,
  consumeDropTargetRemeasureRequest,
  deactivateDomDragController,
  subscribeToDropTargetRemeasureRequests,
} from "./dom-drag-controller";
import type { DragOverlayController } from "./drag-overlay";
import { domRectToDragRect } from "./geometry";
import type {
  DomDragController,
  DomDragEndEvent,
  DomDragSession,
  DomDragStartEvent,
  DomDragUpdateEvent,
} from "./types";

const DROP_TARGET_SELECTOR = "[data-dnd-drop-target-key]";

export type DomPointerCapture = {
  element: HTMLElement;
  pointerId: number;
  previousCursor: string;
};

export type TrackDomDragInput<Payload> = {
  runtime: DragRuntime<Payload>;
  session: DomDragSession;
  controller: DomDragController;
  overlay: DragOverlayController | null;
  dropTargetParent: ParentNode;
  pointerCapture: DomPointerCapture;
  targetingAlgorithm: TargetingAlgorithm;
  onDragStart?: (drag: DomDragStartEvent<Payload>) => void;
  onDragUpdate?: (drag: DomDragUpdateEvent<Payload>) => void;
  onDragEnd?: (drag: DomDragEndEvent<Payload>) => void;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};

export function createDomDragSession(): DomDragSession {
  return {
    dropTargets: [],
    activeDropTargetKey: null,
  };
}

export function findDropTargets(parent: ParentNode): DropTarget[] {
  return getDropTargetElements(parent)
    .map((element) => {
      const dropTargetKey = element.dataset.dndDropTargetKey;

      if (!dropTargetKey) {
        return null;
      }

      return {
        dropTargetKey,
        dropTargetRect: domRectToDragRect(element.getBoundingClientRect()),
      };
    })
    .filter(
      (candidateDropTarget): candidateDropTarget is DropTarget =>
        candidateDropTarget !== null,
    );
}

export function trackDomDrag<Payload>(input: TrackDomDragInput<Payload>): void {
  if (!input.runtime.isDragging) {
    return;
  }

  document.documentElement.dataset.dndDragging = "true";
  input.session.dropTargets = [];
  input.session.activeDropTargetKey = null;

  let pendingPointerMove: PointerEvent | null = null;
  let pointerMoveFrameId: number | null = null;
  let dropTargetRemeasureFrameId: number | null = null;
  let isProcessingPointerMoveFrame = false;
  let isDragSessionActive = true;

  const syncCurrentActiveDropTarget = () => {
    syncActiveDropTarget({
      parent: input.dropTargetParent,
      session: input.session,
      nextDropTargetKey: input.runtime.activeDropTargetKey,
    });
  };
  const measureDropTargets = () => {
    input.session.dropTargets = findDropTargets(input.dropTargetParent);
  };
  const measureTargetsAndRetarget = (): boolean => {
    if (!isDragSessionActive || !input.runtime.isDragging) {
      return false;
    }

    measureDropTargets();
    retargetDrag(input, input.session.dropTargets);
    syncCurrentActiveDropTarget();

    return true;
  };
  const scheduleDropTargetRemeasure = () => {
    if (!isDragSessionActive || !input.runtime.isDragging) {
      return;
    }

    if (isProcessingPointerMoveFrame || dropTargetRemeasureFrameId !== null) {
      return;
    }

    dropTargetRemeasureFrameId = window.requestAnimationFrame(() => {
      dropTargetRemeasureFrameId = null;
      flushPendingDropTargetRemeasure();
    });
  };
  const flushPendingDropTargetRemeasure = (): boolean => {
    if (!consumeDropTargetRemeasureRequest(input.controller)) {
      return false;
    }

    if (dropTargetRemeasureFrameId !== null) {
      window.cancelAnimationFrame(dropTargetRemeasureFrameId);
      dropTargetRemeasureFrameId = null;
    }

    return measureTargetsAndRetarget();
  };
  const unsubscribeDropTargetRemeasureRequests =
    subscribeToDropTargetRemeasureRequests(
      input.controller,
      scheduleDropTargetRemeasure,
    );

  activateDomDragController(input.controller);
  emitDragStart(input);
  measureDropTargets();

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
        syncCurrentActiveDropTarget();
        emitDragUpdate(input, previousDropTargetKey);
        flushPendingDropTargetRemeasure();
      } finally {
        isProcessingPointerMoveFrame = false;
      }
    });
  };

  const handlePointerEnd = () => {
    if (!input.runtime.isDragging) {
      return;
    }

    if (!flushPendingDropTargetRemeasure()) {
      retargetDrag(input, input.session.dropTargets);
      syncCurrentActiveDropTarget();
    }

    releaseDrag();
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  function releaseDrag(): void {
    removeListeners();
    isDragSessionActive = false;
    cancelPendingDropTargetRemeasure();
    unsubscribeDropTargetRemeasureRequests();
    deactivateDomDragController(input.controller);
    releaseDomDrag(input);
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

  function cancelPendingDropTargetRemeasure(): void {
    if (dropTargetRemeasureFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(dropTargetRemeasureFrameId);
    dropTargetRemeasureFrameId = null;
  }
}

function onPointerMove<Payload>(
  input: TrackDomDragInput<Payload>,
  event: PointerEvent,
): void {
  if (!input.runtime.isDragging) {
    return;
  }

  moveDrag(input.runtime, {
    pointerPosition: {
      x: event.clientX,
      y: event.clientY,
    },
  });

  input.overlay?.sync();

  retargetDrag(input, input.session.dropTargets);
}

function retargetDrag<Payload>(
  input: TrackDomDragInput<Payload>,
  dropTargets: readonly DropTarget[],
): void {
  const activeDropTarget = input.targetingAlgorithm({
    runtime: input.runtime,
    dropTargets,
  });

  setActiveDropTarget(input.runtime, {
    dropTargetKey: activeDropTarget?.dropTargetKey ?? null,
  });
}

function emitDragUpdate<Payload>(
  input: TrackDomDragInput<Payload>,
  previousDropTargetKey: string | null,
): void {
  const draggedKey = input.runtime.draggedKey;
  const payload = input.runtime.payload;
  const pointerPosition = input.runtime.pointerPosition;

  if (draggedKey === null || payload === null || pointerPosition === null) {
    return;
  }

  input.onDragUpdate?.({
    draggedKey,
    payload,
    pointerPosition,
    overlayRect: input.runtime.overlayRect,
    activeDropTargetKey: input.runtime.activeDropTargetKey,
    previousDropTargetKey,
  });
}

function emitDragStart<Payload>(input: TrackDomDragInput<Payload>): void {
  const draggedKey = input.runtime.draggedKey;
  const payload = input.runtime.payload;

  if (draggedKey === null || payload === null) {
    return;
  }

  input.onDragStart?.({
    draggedKey,
    payload,
  });
}

function releaseDomDrag<Payload>(input: TrackDomDragInput<Payload>): void {
  const draggedKey = input.runtime.draggedKey;
  const payload = input.runtime.payload;
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
  input.session.dropTargets = [];

  input.overlay?.destroy();

  if (draggedKey !== null && payload !== null) {
    input.onDragEnd?.({
      draggedKey,
      payload,
      dropTargetKey,
    });
  }

  endDrag(input.runtime);

  if (drop) {
    input.onDrop?.(drop);
  }
}

function syncActiveDropTarget(input: {
  parent: ParentNode;
  session: DomDragSession;
  nextDropTargetKey: string | null;
}): void {
  const previousDropTargetKey = input.session.activeDropTargetKey;

  if (previousDropTargetKey === input.nextDropTargetKey) {
    if (previousDropTargetKey === null) {
      return;
    }

    const currentDropTarget = getDropTargetElement(
      previousDropTargetKey,
      input.parent,
    );

    if (currentDropTarget) {
      currentDropTarget.dataset.dndActiveDropTarget = "true";
      return;
    }
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

function getDropTargetElements(parent: ParentNode): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>(DROP_TARGET_SELECTOR));
}

function getDropTargetElement(
  dropTargetKey: string,
  parent: ParentNode = document,
): HTMLElement | null {
  return parent.querySelector<HTMLElement>(
    `[data-dnd-drop-target-key="${CSS.escape(dropTargetKey)}"]`,
  );
}
