export function clearActiveDropTarget(
  currentDropTargetElement: HTMLElement | null,
): null {
  if (currentDropTargetElement) {
    delete currentDropTargetElement.dataset.dndActiveDropTarget;
  }

  return null;
}
