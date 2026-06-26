import { clearActiveDropTarget } from "./clear-active-drop-target";
import { getDropTargetElement } from "../targeting/drop-target-elements";

export function syncActiveDropTarget(
  dropTargetKey: string | null,
  currentDropTargetElement: HTMLElement | null,
): HTMLElement | null {
  if (currentDropTargetElement?.dataset.dndDropTargetKey === dropTargetKey) {
    return currentDropTargetElement;
  }

  clearActiveDropTarget(currentDropTargetElement);

  if (!dropTargetKey) {
    return null;
  }

  const nextDropTarget = getDropTargetElement(dropTargetKey);

  if (!nextDropTarget) {
    return null;
  }

  nextDropTarget.dataset.dndActiveDropTarget = "true";

  return nextDropTarget;
}
