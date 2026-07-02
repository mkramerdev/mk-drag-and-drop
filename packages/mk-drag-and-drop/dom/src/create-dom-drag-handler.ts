import type { CreateDomDragHandlerOptions, DomDragHandler } from "./types.js";
import { pointerToCenter } from "@mk-drag-and-drop/core";

import { trackDomDrag } from "./dom-drag-session.js";
import { startDomDrag } from "./start-dom-drag.js";

export function createDomDragHandler(
  options: CreateDomDragHandlerOptions,
): DomDragHandler {
  return (event) => {
    const dragStart = startDomDrag(options, event);

    if (!dragStart) {
      return;
    }

    const dropTargetParent =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : document;

    trackDomDrag({
      runtime: options.runtime,
      session: options.session,
      dropTargetParent,
      pointerCapture: dragStart.pointerCapture,
      targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
      targetingConstraint: options.targetingConstraint,
      onDragStart: options.onDragStart,
      onDragUpdate: options.onDragUpdate,
      onDragEnd: options.onDragEnd,
      onDrop: options.onDrop,
    });
  };
}
