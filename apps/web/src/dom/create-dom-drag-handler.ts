import type {
  CreateDomDragHandlerOptions,
  DomDropTargetCollectionContext,
} from "./types";
import { pointerToCenter, setOverlayRect } from "../core";

import { findDropTargets, trackDomDrag } from "./dom-drag-session";
import { renderDragOverlay } from "./drag-overlay";
import { startDomDrag } from "./start-dom-drag";

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

    const dropTargetParent =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document;
    const getDropTargetContext =
      (): DomDropTargetCollectionContext<Payload> | null => {
        const draggedKey = options.runtime.draggedKey;
        const payload = options.runtime.payload;
        const pointerPosition = options.runtime.pointerPosition;

        if (
          draggedKey === null ||
          payload === null ||
          pointerPosition === null
        ) {
          return null;
        }

        return {
          draggedKey,
          payload,
          pointerPosition,
          overlayRect: options.runtime.overlayRect,
        };
      };
    const getDropTargets = () => {
      const context = getDropTargetContext();

      if (!context) {
        return [];
      }

      return (
        options.getDropTargets?.(dropTargetParent, context) ??
        findDropTargets(dropTargetParent)
      );
    };
    const dropTargets = getDropTargets();

    trackDomDrag({
      runtime: options.runtime,
      overlay,
      dropTargetParent,
      dropTargets,
      getDropTargets,
      remeasureDropTargetsOnDragUpdate:
        options.remeasureDropTargetsOnDragUpdate,
      pointerCapture: dragStart.pointerCapture,
      targetingAlgorithm:
        options.targetingAlgorithm ?? pointerToCenter,
      onDragUpdate: options.onDragUpdate,
      onDragEnd: options.onDragEnd,
      onDrop: options.onDrop,
    });
  };
}
