export const domDragHandleAttribute = "data-dnd-drag-handle";
export const domDragHandleSelector = `[${domDragHandleAttribute}]`;

const interactiveElementSelector = [
  "a[href]",
  "button",
  "input",
  "option",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
].join(",");

export function shouldStartDragFromTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): boolean {
  const eventTarget = getEventTargetElement(input.eventTarget);

  if (!eventTarget) {
    return false;
  }

  const hasDragHandle =
    input.draggableElement.querySelector(domDragHandleSelector) !== null;

  if (!hasDragHandle) {
    return !isInteractiveDragTarget({
      draggableElement: input.draggableElement,
      eventTarget,
    });
  }

  const closestDragHandle = eventTarget.closest(domDragHandleSelector);

  return (
    closestDragHandle !== null &&
    input.draggableElement.contains(closestDragHandle)
  );
}

export function shouldHandleKeyboardDragFromTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): boolean {
  const eventTarget = getEventTargetElement(input.eventTarget);

  if (!eventTarget) {
    return false;
  }

  if (
    isInteractiveDragTarget({
      draggableElement: input.draggableElement,
      eventTarget,
    })
  ) {
    return false;
  }

  if (eventTarget === input.draggableElement) {
    return true;
  }

  const closestDragHandle = eventTarget.closest(domDragHandleSelector);

  return (
    closestDragHandle !== null &&
    input.draggableElement.contains(closestDragHandle)
  );
}

function getEventTargetElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function isInteractiveDragTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: Element;
}): boolean {
  return (
    closestWithin(
      input.eventTarget,
      interactiveElementSelector,
      input.draggableElement,
    ) !== null ||
    getEditableElement(input.eventTarget, input.draggableElement) !== null
  );
}

function closestWithin(
  element: Element,
  selector: string,
  boundary: HTMLElement,
): Element | null {
  const closestElement = element.closest(selector);

  return closestElement && boundary.contains(closestElement)
    ? closestElement
    : null;
}

function getEditableElement(
  element: Element,
  boundary: HTMLElement,
): HTMLElement | null {
  let currentElement: Element | null = element;

  while (currentElement && boundary.contains(currentElement)) {
    if (
      currentElement instanceof HTMLElement &&
      currentElement.isContentEditable
    ) {
      return currentElement;
    }

    if (currentElement === boundary) {
      return null;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}
