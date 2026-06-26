import { clearActiveDropTarget } from "./clear-active-droptarget";
import { getDropTargetElement } from "../targeting/drop-target-elements";

export function syncActiveDropTarget(
  key: string | null,
  currentDropTarget: HTMLElement | null,
): HTMLElement | null {
  if (currentDropTarget?.dataset.dndDropTargetId === key) {
    return currentDropTarget;
  }

  clearActiveDropTarget(currentDropTarget);

  if (!key) {
    return null;
  }

  const nextDropTarget = getDropTargetElement(key);

  if (!nextDropTarget) {
    return null;
  }

  nextDropTarget.dataset.dndActiveDropTarget = "true";

  return nextDropTarget;
}
