import type {
  DomPointerCapture,
  TrackDomDragInput,
} from "../types";

import { onPointerMove } from "./on-pointer-move";
import { releaseDomDrag } from "./release-dom-drag";
import { syncActiveDropTarget } from "./sync-active-drop-target";

export function trackDomDrag<Payload>(
  input: TrackDomDragInput<Payload>,
): void {
  if (!input.runtime.isDragging) {
    return;
  }

  document.documentElement.dataset.dndDragging = "true";

  let activeDropTargetElement: HTMLElement | null = null;
  let pendingPointerMove: PointerEvent | null = null;
  let pointerMoveFrameId: number | null = null;

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

      onPointerMove(input, latestPointerMove);

      activeDropTargetElement = syncActiveDropTarget(
        input.runtime.activeDropTargetKey,
        activeDropTargetElement,
      );
    });
  };

  const handlePointerEnd = () => {
    if (!input.runtime.isDragging) {
      return;
    }

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

function releasePointerCapture(pointerCapture: DomPointerCapture): void {
  if (pointerCapture.element.hasPointerCapture(pointerCapture.pointerId)) {
    pointerCapture.element.releasePointerCapture(pointerCapture.pointerId);
  }

  pointerCapture.element.style.cursor = pointerCapture.previousCursor;
}
