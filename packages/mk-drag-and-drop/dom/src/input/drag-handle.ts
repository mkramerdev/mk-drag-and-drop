export const domDragHandleAttribute = "data-dnd-drag-handle";
export const domDragHandleSelector = `[${domDragHandleAttribute}]`;

const pointerInteractiveElementSelector = [
  "button",
  "input",
  "option",
  "select",
  "textarea",
  "[role='button']",
  "[role='textbox']",
].join(",");

const linkElementSelector = "a[href],[role='link']";

const keyboardInteractiveElementSelector = [
  pointerInteractiveElementSelector,
  linkElementSelector,
].join(",");

export function shouldStartDragFromTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): boolean {
  return getPointerDragStartTarget(input) !== null;
}

export function getPointerDragStartTarget(input: {
  draggableElement: HTMLElement;
  eventTarget: EventTarget | null;
}): { captureTarget: Element; preservePointerDownDefault: boolean } | null {
  const eventTarget = getEventTargetElement(input.eventTarget);

  if (!eventTarget) {
    return null;
  }

  const hasDragHandle =
    input.draggableElement.querySelector(domDragHandleSelector) !== null;

  if (!hasDragHandle) {
    if (
      isInteractiveDragTarget({
        draggableElement: input.draggableElement,
        eventTarget,
        selector: pointerInteractiveElementSelector,
      })
    ) {
      return null;
    }

    return {
      captureTarget: input.draggableElement,
      preservePointerDownDefault:
        closestWithin(
          eventTarget,
          linkElementSelector,
          input.draggableElement,
        ) !== null,
    };
  }

  const closestDragHandle = eventTarget.closest(domDragHandleSelector);

  return closestDragHandle !== null &&
    input.draggableElement.contains(closestDragHandle)
    ? { captureTarget: closestDragHandle, preservePointerDownDefault: false }
    : null;
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
      selector: keyboardInteractiveElementSelector,
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
  selector: string;
}): boolean {
  return (
    closestWithin(input.eventTarget, input.selector, input.draggableElement) !==
      null ||
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
