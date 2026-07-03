export const domDragHandleAttribute = "data-dnd-drag-handle";
export const domDragHandleSelector = `[${domDragHandleAttribute}]`;

export function shouldStartDragFromTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): boolean {
  if (!(input.eventTarget instanceof Element)) {
    return false;
  }

  const hasDragHandle =
    input.draggableElement.querySelector(domDragHandleSelector) !== null;

  if (!hasDragHandle) {
    return true;
  }

  const closestDragHandle = input.eventTarget.closest(domDragHandleSelector);

  return (
    closestDragHandle !== null &&
    input.draggableElement.contains(closestDragHandle)
  );
}

export function shouldHandleKeyboardDragFromTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): boolean {
  if (!(input.eventTarget instanceof Element)) {
    return false;
  }

  if (input.eventTarget === input.draggableElement) {
    return true;
  }

  const closestDragHandle = input.eventTarget.closest(domDragHandleSelector);

  return (
    closestDragHandle !== null &&
    input.draggableElement.contains(closestDragHandle)
  );
}
