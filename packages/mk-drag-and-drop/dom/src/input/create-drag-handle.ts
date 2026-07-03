import { domDragHandleAttribute } from "./drag-handle.js";

export type CreateDragHandleInput = {
  element: HTMLElement;
};

export type CreateDragHandleCleanup = () => void;

export function createDragHandle(
  input: CreateDragHandleInput,
): CreateDragHandleCleanup {
  const hadPreviousAttribute =
    input.element.hasAttribute(domDragHandleAttribute);
  const previousAttributeValue = input.element.getAttribute(
    domDragHandleAttribute,
  );
  let cleanedUp = false;

  input.element.setAttribute(domDragHandleAttribute, "true");

  return (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (hadPreviousAttribute) {
      input.element.setAttribute(
        domDragHandleAttribute,
        previousAttributeValue ?? "",
      );
      return;
    }

    input.element.removeAttribute(domDragHandleAttribute);
  };
}
