import type { TrackDomDragInput } from "../types";

import { endDrag } from "../../core/runtime/end-drag";
import { clearActiveDropTarget } from "./clear-active-drop-target";

export function releaseDomDrag<Payload>(
  input: TrackDomDragInput<Payload>,
  currentDropTarget: HTMLElement | null,
): null {
  const draggedKey = input.runtime.draggedKey;
  const payload = input.runtime.payload;
  const dropTargetKey = input.runtime.activeDropTargetKey;
  const drop =
    draggedKey !== null && dropTargetKey !== null
      ? {
          draggedKey,
          dropTargetKey,
        }
      : null;

  delete document.documentElement.dataset.dndDragging;
  clearActiveDropTarget(currentDropTarget);

  input.overlay?.destroy();

  if (draggedKey !== null && payload !== null) {
    input.onDragEnd?.({
      draggedKey,
      payload,
      dropTargetKey,
    });
  }

  endDrag(input.runtime);

  if (drop) {
    input.onDrop?.(drop);
  }

  return null;
}
