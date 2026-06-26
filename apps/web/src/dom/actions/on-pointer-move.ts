import type { TrackDomDragInput } from "./track-dom-drag";

import { moveDrag } from "../../core/runtime/moveDrag";
import { setActiveDropTarget } from "../../core/runtime/setActiveDropTarget";

export function onPointerMove<Payload>(
  input: TrackDomDragInput<Payload>,
  event: PointerEvent,
): void {
  if (!input.runtime.isDragging) {
    return;
  }

  moveDrag(input.runtime, {
    pointerPosition: {
      x: event.clientX,
      y: event.clientY,
    },
  });

  input.overlay?.sync();

  const activeDropTarget = input.targetingAlgorithm({
    runtime: input.runtime,
    dropTargets: input.dropTargets,
  });

  setActiveDropTarget(input.runtime, {
    key: activeDropTarget?.key ?? null,
  });
}
