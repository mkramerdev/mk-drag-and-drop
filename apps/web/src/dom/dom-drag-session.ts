import type { DropTarget, DragRuntime, TargetingAlgorithm } from "../core";
import { endDrag, moveDrag, setActiveDropTarget } from "../core";
import type { DomDragEndEvent, DomDragUpdateEvent } from "./types";
import type { DragOverlayController } from "./drag-overlay";
import { domRectToDragRect } from "./geometry";

const DROP_TARGET_SELECTOR = "[data-dnd-drop-target-key]";

export type DomPointerCapture = {
  element: HTMLElement;
  pointerId: number;
  previousCursor: string;
};

export type TrackDomDragInput<Payload> = {
  runtime: DragRuntime<Payload>;
  overlay: DragOverlayController | null;
  dropTargetParent: ParentNode;
  pointerCapture: DomPointerCapture;
  targetingAlgorithm: TargetingAlgorithm;
  getDropTargetMeasurementKey?: () => unknown;
  onDragUpdate?: (drag: DomDragUpdateEvent<Payload>) => void;
  onDragEnd?: (drag: DomDragEndEvent<Payload>) => void;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};

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

  let activeDropTargetElement: HTMLElement | null = null;
  let dropTargets = findDropTargets(input.dropTargetParent);
  let dropTargetMeasurementKey = input.getDropTargetMeasurementKey?.();
  let pendingPointerMove: PointerEvent | null = null;
  let pointerMoveFrameId: number | null = null;
  const syncCurrentActiveDropTarget = () => {
    activeDropTargetElement = syncActiveDropTarget(
      input.runtime.activeDropTargetKey,
      activeDropTargetElement,
      input.dropTargetParent,
    );
  };
  const refreshDropTargetsIfMeasurementKeyChanged = (): boolean => {
    const getDropTargetMeasurementKey = input.getDropTargetMeasurementKey;

    if (!getDropTargetMeasurementKey) {
      return false;
    }

    const nextDropTargetMeasurementKey = getDropTargetMeasurementKey();

    if (Object.is(nextDropTargetMeasurementKey, dropTargetMeasurementKey)) {
      return false;
    }

    dropTargetMeasurementKey = nextDropTargetMeasurementKey;
    dropTargets = findDropTargets(input.dropTargetParent);

    return true;
  };

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

      const previousDropTargetKey = input.runtime.activeDropTargetKey;

      refreshDropTargetsIfMeasurementKeyChanged();
      onPointerMove(input, latestPointerMove, {
        dropTargets,
      });

      syncCurrentActiveDropTarget();

      emitDragUpdate(input, {
        previousDropTargetKey,
      });

      if (refreshDropTargetsIfMeasurementKeyChanged()) {
        retargetDrag(input, dropTargets);
        syncCurrentActiveDropTarget();
      }
    });
  };

  const handlePointerEnd = () => {
    if (!input.runtime.isDragging) {
      return;
    }

    refreshDropTargetsIfMeasurementKeyChanged();
    retargetDrag(input, dropTargets);
    syncCurrentActiveDropTarget();
    releaseDrag();
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  function releaseDrag(): void {
    removeListeners();
    activeDropTargetElement = releaseDomDrag(input, activeDropTargetElement);
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
}

function onPointerMove<Payload>(
  input: TrackDomDragInput<Payload>,
  event: PointerEvent,
  options: {
    dropTargets: readonly DropTarget[];
  },
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

  retargetDrag(input, options.dropTargets);
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
  options: {
    previousDropTargetKey: string | null;
  },
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
    previousDropTargetKey: options.previousDropTargetKey,
  });
}

function releaseDomDrag<Payload>(
  input: TrackDomDragInput<Payload>,
  currentDropTarget: HTMLElement | null,
): null {
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
  clearActiveDropTarget(currentDropTarget);

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

  return null;
}

function syncActiveDropTarget(
  dropTargetKey: string | null,
  currentDropTargetElement: HTMLElement | null,
  parent: ParentNode,
): HTMLElement | null {
  if (currentDropTargetElement?.dataset.dndDropTargetKey === dropTargetKey) {
    return currentDropTargetElement;
  }

  clearActiveDropTarget(currentDropTargetElement);

  if (!dropTargetKey) {
    return null;
  }

  const nextDropTarget = getDropTargetElement(dropTargetKey, parent);

  if (!nextDropTarget) {
    return null;
  }

  nextDropTarget.dataset.dndActiveDropTarget = "true";

  return nextDropTarget;
}

function clearActiveDropTarget(
  currentDropTargetElement: HTMLElement | null,
): null {
  if (currentDropTargetElement) {
    delete currentDropTargetElement.dataset.dndActiveDropTarget;
  }

  return null;
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
