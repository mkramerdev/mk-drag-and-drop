import type { DomDragStartOptions, DomDragStartResult } from "../types";

import { startDrag } from "../../core/runtime/start-drag";
import { DragAlreadyActiveError } from "../../core/runtime/error";
import { domRectToDragRect } from "../targeting/dom-rect-to-drag-rect";
import { convertPointerEvent } from "./convert-pointer-event";

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
  const draggedElement = document.getElementById(draggedKey);

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
      pointerPosition: convertPointerEvent(event),
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
