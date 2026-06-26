import type { CreateDomDragHandlerOptions } from "./types";
import { pointerToCenter } from '../core/targeting/pointer-to-center';

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
    const didStart = startDomDrag(options, event);

    if (!didStart) {
      return;
    }

    const overlay = renderDragOverlay({
      renderer: options.renderOverlay,
      runtime: options.runtime,
      placement: options.overlayPlacement,
    });
    const dropTargets = findDropTargets(
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document,
    );

    trackDomDrag({
      runtime: options.runtime,
      overlay,
      dropTargets,
      targetingAlgorithm:
        options.targetingAlgorithm ?? pointerToCenter,
      onDrop: options.onDrop,
    });
  };
}
