export function getDropTargetElement(dropTargetId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-dnd-drop-target-id="${CSS.escape(dropTargetId)}"]`,
  );
}
