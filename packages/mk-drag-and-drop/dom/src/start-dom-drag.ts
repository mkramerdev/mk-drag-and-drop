import type { DragPoint } from "@mk-drag-and-drop/core";
import { startDomDragRuntime } from "./dom-drag-runtime.js";
import type { DomPointerCapture } from "./dom-drag-session.js";
import type { DomDragRuntime, DomPointerDownEvent } from "./types.js";

type DomDragStartOptions = {
  runtime: DomDragRuntime;
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

  if (options.runtime.isDragging) {
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

    const didStartDrag = startDomDragRuntime(options.runtime, {
      draggedKey,
      pointerPosition: pointerEventToDragPoint(event),
    });

    if (!didStartDrag) {
      if (didCapturePointer && dragHandle.hasPointerCapture(event.pointerId)) {
        dragHandle.releasePointerCapture(event.pointerId);
      }

      if (didSetCursor) {
        dragHandle.style.cursor = previousCursor;
      }

      return null;
    }
  } catch (error) {
    if (didCapturePointer && dragHandle.hasPointerCapture(event.pointerId)) {
      dragHandle.releasePointerCapture(event.pointerId);
    }

    if (didSetCursor) {
      dragHandle.style.cursor = previousCursor;
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
