import type { TrackDomDragInput } from "../types";

import { moveDrag } from "../../core/runtime/move-drag";
import { setActiveDropTarget } from "../../core/runtime/set-active-drop-target";

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
    dropTargetKey: activeDropTarget?.dropTargetKey ?? null,
  });
}
