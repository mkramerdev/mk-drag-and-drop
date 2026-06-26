export function clearActiveDropTarget(
  currentDropTarget: HTMLElement | null,
): null {
  if (currentDropTarget) {
    delete currentDropTarget.dataset.dndActiveDropTarget;
  }

  return null;
}
