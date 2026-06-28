import type { DragPoint, DragRect, DragRuntime } from "../core";
import { DragAlreadyActiveError, startDrag } from "../core";
import type { DomPointerCapture } from "./dom-drag-session";
import { domRectToDragRect } from "./geometry";

type DomDragStartOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (draggedKey: string) => Payload | null;
  getDraggedElement?: (
    draggedKey: string,
    dragHandle: HTMLElement,
  ) => HTMLElement | null;
};

type DomDragStartResult<Payload> = {
  draggedKey: string;
  payload: Payload;
  draggedElementRect: DragRect;
  pointerCapture: DomPointerCapture;
};

export function startDomDrag<Payload>(
  options: DomDragStartOptions<Payload>,
  event: PointerEvent,
): DomDragStartResult<Payload> | null {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }

  const dragHandle = event.target;
  const draggedKey = dragHandle.dataset.dndDragKey;

  if (!draggedKey) {
    return null;
  }

  const payload = options.getPayload(draggedKey);
  const draggedElement = options.getDraggedElement
    ? options.getDraggedElement(draggedKey, dragHandle)
    : document.getElementById(draggedKey);

  if (payload === null || !draggedElement) {
    return null;
  }

  const draggedElementRect = domRectToDragRect(
    draggedElement.getBoundingClientRect(),
  );
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
      payload,
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
    draggedKey,
    payload,
    draggedElementRect,
    pointerCapture: {
      element: dragHandle,
      pointerId: event.pointerId,
      previousCursor,
    },
  };
}

function pointerEventToDragPoint(event: PointerEvent): DragPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}
