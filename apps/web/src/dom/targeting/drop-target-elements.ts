const DROP_TARGET_SELECTOR = "[data-dnd-drop-target-id]";

export function getDropTargetElements(parent: ParentNode): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>(DROP_TARGET_SELECTOR));
}

export function getDropTargetElement(
  dropTargetKey: string,
  parent: ParentNode = document,
): HTMLElement | null {
  return parent.querySelector<HTMLElement>(
    `[data-dnd-drop-target-id="${CSS.escape(dropTargetKey)}"]`,
  );
}
