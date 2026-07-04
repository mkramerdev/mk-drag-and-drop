import type { DragController } from "../controller/create-drag-controller.js";
import { getControllerRuntime } from "../controller/controller-internals.js";
import { createDomDraggable } from "./create-draggable.js";

export type CreateDraggableInput = {
  controller: DragController;
  element: HTMLElement;
  draggableId: string;
  group?: string;
};

const defaultDraggableGroup = "default";

export function createDraggable(input: CreateDraggableInput): void {
  const elementRef = new WeakRef(input.element);
  const runtime = getControllerRuntime(input.controller);
  const behavior = createDomDraggable({
    runtime,
    draggableId: input.draggableId,
    group: input.group ?? defaultDraggableGroup,
    getElement: () => elementRef.deref() ?? null,
  });
  const previousTabIndex = input.element.getAttribute("tabindex");
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
    const element = elementRef.deref();

    if (!element) {
      return;
    }

    element.removeEventListener("pointerdown", onPointerDown);

    if (keyDownAttached) {
      element.removeEventListener("keydown", onKeyDown);

      if (previousTabIndex === null) {
        element.removeAttribute("tabindex");
      } else {
        element.setAttribute("tabindex", previousTabIndex);
      }
    }
  };

  runtime.onDispose(cleanup);
}
