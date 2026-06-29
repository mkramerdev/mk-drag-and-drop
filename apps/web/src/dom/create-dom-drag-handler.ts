import type { CreateDomDragHandlerOptions, DomDragHandler } from "./types";
import { pointerToCenter, setOverlayRect } from "../core";

import { trackDomDrag } from "./dom-drag-session";
import { renderDragOverlay } from "./drag-overlay";
import { startDomDrag } from "./start-dom-drag";

export function createDomDragHandler<Payload>(
  options: CreateDomDragHandlerOptions<Payload>,
): DomDragHandler {
  return {
    handlePointerDown: (event) => {
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

      const dropTargetParent =
        event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : document;

      trackDomDrag({
        runtime: options.runtime,
        overlay,
        dropTargetParent,
        pointerCapture: dragStart.pointerCapture,
        targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
        getDropTargetMeasurementKey: options.getDropTargetMeasurementKey,
        onDragUpdate: options.onDragUpdate,
        onDragEnd: options.onDragEnd,
        onDrop: options.onDrop,
      });
    },
  };
}
