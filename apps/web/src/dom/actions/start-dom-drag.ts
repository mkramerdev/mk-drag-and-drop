import type { DragRect } from "../../core/runtime/types";
import type { DomDragStartOptions } from "../types";

import { startDrag } from "../../core/runtime/start-drag";
import { DragAlreadyActiveError } from "../../core/runtime/error";
import { convertPointerEvent } from "./convert-pointer-event";

export function startDomDrag<Payload>(
  options: DomDragStartOptions<Payload>,
  event: PointerEvent,
): boolean {
  if (!(event.target instanceof HTMLElement)) {
    return false;
  }

  const key = event.target.dataset.dndDragHandleFor;

  if (!key) {
    return false;
  }

  const payload = options.getPayload(key);
  const draggedElement = document.getElementById(key);

  if (payload === null || !draggedElement) {
    return false;
  }

  try {
    startDrag(options.runtime, {
      key,
      payload,
      pointerPosition: convertPointerEvent(event),
      rect: toDragRect(draggedElement.getBoundingClientRect()),
    });
  } catch (error) {
    if (error instanceof DragAlreadyActiveError) {
      return false;
    }

    throw error;
  }

  return true;
}


function toDragRect(rect: DOMRect): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}
