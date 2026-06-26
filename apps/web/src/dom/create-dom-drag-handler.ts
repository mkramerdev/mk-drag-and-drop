import type { CreateDomDragHandlerOptions } from "./types";
import { pointerToCenter } from '../core/targeting/pointer-to-center';
import { setOverlayRect } from "../core/runtime/set-overlay-rect";

import { findDropTargets } from "./targeting/find-drop-targets";
import {
  renderDragOverlay,
} from "./drag-overlay/render-drag-overlay";
import { startDomDrag } from "./actions/start-dom-drag";
import { trackDomDrag } from "./actions/track-dom-drag";

export function createDomDragHandler<Payload>(
  options: CreateDomDragHandlerOptions<Payload>,
): (event: PointerEvent) => void {
  return (event) => {
    const dragStart = startDomDrag(options, event);

    if (!dragStart) {
      return;
    }

    options.onDragStart?.({
      draggedKey: dragStart.draggedKey,
      payload: dragStart.payload,
    });

    const overlay = renderDragOverlay({
      renderContent: options.renderOverlayContent,
      runtime: options.runtime,
      draggedElementRect: dragStart.draggedElementRect,
      placement: options.overlayPlacement,
    });

    if (overlay) {
      setOverlayRect(options.runtime, overlay.initialOverlayRect);
    }

    const dropTargets = findDropTargets(
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document,
    );

    trackDomDrag({
      runtime: options.runtime,
      overlay,
      dropTargets,
      pointerCapture: dragStart.pointerCapture,
      targetingAlgorithm:
        options.targetingAlgorithm ?? pointerToCenter,
      onDragEnd: options.onDragEnd,
      onDrop: options.onDrop,
    });
  };
}
