import { clearActiveDropTarget } from "./clear-active-droptarget";

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

  const nextDropTarget = document.querySelector<HTMLElement>(
    `[data-dnd-drop-target-id="${CSS.escape(key)}"]`,
  );

  if (!nextDropTarget) {
    return null;
  }

  nextDropTarget.dataset.dndActiveDropTarget = "true";

  return nextDropTarget;
}
