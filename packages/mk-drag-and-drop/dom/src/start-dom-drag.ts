import type { DragPoint, DragRuntime } from "@mk-drag-and-drop/core";
import { DragAlreadyActiveError, startDrag } from "@mk-drag-and-drop/core";
import type { DomPointerCapture } from "./dom-drag-session.js";
import type { DomPointerDownEvent } from "./types.js";

type DomDragStartOptions = {
  runtime: DragRuntime;
};

type DomDragStartResult = {
  pointerCapture: DomPointerCapture;
};

export function startDomDrag(
  options: DomDragStartOptions,
  event: DomPointerDownEvent,
): DomDragStartResult | null {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }

  const dragHandle = event.target;
  const draggedKey = dragHandle.dataset.dndDragKey;

  if (!draggedKey) {
    return null;
  }

  const previousCursor = dragHandle.style.cursor;
  let didCapturePointer = false;
  let didSetCursor = false;

  try {
    dragHandle.setPointerCapture(event.pointerId);
    didCapturePointer = true;
    dragHandle.style.cursor = "grabbing";
    didSetCursor = true;

    startDrag(options.runtime, {
      draggedKey,
      pointerPosition: pointerEventToDragPoint(event),
    });
  } catch (error) {
    if (didCapturePointer && dragHandle.hasPointerCapture(event.pointerId)) {
      dragHandle.releasePointerCapture(event.pointerId);
    }

    if (didSetCursor) {
      dragHandle.style.cursor = previousCursor;
    }

    if (error instanceof DragAlreadyActiveError) {
      return null;
    }

    throw error;
  }

  return {
    pointerCapture: {
      element: dragHandle,
      pointerId: event.pointerId,
      previousCursor,
    },
  };
}

function pointerEventToDragPoint(event: DomPointerDownEvent): DragPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}
