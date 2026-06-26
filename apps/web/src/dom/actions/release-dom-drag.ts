import type { TrackDomDragInput } from "./track-dom-drag";

import { endDrag } from "../../core/runtime/endDrag";
import { clearActiveDropTarget } from "./clear-active-droptarget";

export function releaseDomDrag<Payload>(
  input: TrackDomDragInput<Payload>,
  currentDropTarget: HTMLElement | null,
): null {
  const drop =
    input.runtime.key && input.runtime.activeDropTargetKey
      ? {
          draggedKey: input.runtime.key,
          dropTargetKey: input.runtime.activeDropTargetKey,
        }
      : null;

  delete document.documentElement.dataset.dndDragging;
  clearActiveDropTarget(currentDropTarget);

  input.overlay?.destroy();
  endDrag(input.runtime);

  if (drop) {
    input.onDrop?.(drop);
  }

  return null;
}
