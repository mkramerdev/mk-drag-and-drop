import type { DragController } from "../controller/create-drag-controller.js";
import { createDomDraggable } from "./create-draggable.js";

export type CreateDraggableInput = {
  controller: DragController;
  element: HTMLElement;
  itemId: string;
  group?: string;
};

export type CreateDraggableCleanup = () => void;

const defaultDraggableGroup = "default";

export function createDraggable(
  input: CreateDraggableInput,
): CreateDraggableCleanup {
  const behavior = createDomDraggable({
    runtime: input.controller.runtime,
    itemId: input.itemId,
    group: input.group ?? defaultDraggableGroup,
    getElement: () => input.element,
  });
  const previousTabIndex = input.element.getAttribute("tabindex");
  let disposeCleanup: (() => void) | null = null;
  let keyDownAttached = false;
  let cleanedUp = false;

  const onPointerDown = (event: PointerEvent): void => {
    behavior.onPointerDown(event);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    behavior.onKeyDown(event);
  };

  input.element.addEventListener("pointerdown", onPointerDown);

  if (behavior.tabIndex !== undefined) {
    input.element.tabIndex = behavior.tabIndex;
    input.element.addEventListener("keydown", onKeyDown);
    keyDownAttached = true;
  }

  const cleanup = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    input.element.removeEventListener("pointerdown", onPointerDown);

    if (keyDownAttached) {
      input.element.removeEventListener("keydown", onKeyDown);

      if (previousTabIndex === null) {
        input.element.removeAttribute("tabindex");
      } else {
        input.element.setAttribute("tabindex", previousTabIndex);
      }
    }

    const unsubscribe = disposeCleanup;
    disposeCleanup = null;
    unsubscribe?.();
  };

  disposeCleanup = input.controller.runtime.onDispose(cleanup);

  return cleanup;
}
