import type { DragController } from "../controller/create-drag-controller.js";
import { getControllerRuntime } from "../controller/controller-internals.js";
import { createDomSortable } from "./create-sortable.js";

export type CreateSortableInput = {
  controller: DragController;
  element: HTMLElement;
  draggableId: string;
  group?: string;
  containerId?: string | null;
};

const defaultSortableGroup = "default";

export function createSortable(input: CreateSortableInput): void {
  const elementRef = new WeakRef(input.element);
  const runtime = getControllerRuntime(input.controller);
  const behavior = createDomSortable({
    runtime,
    draggableId: input.draggableId,
    group: input.group ?? defaultSortableGroup,
    containerId: input.containerId ?? null,
    getElement: () => elementRef.deref() ?? null,
  });
  const hadPreviousTabIndex = input.element.hasAttribute("tabindex");
  const previousTabIndex = input.element.getAttribute("tabindex");
  let keyDownAttached = false;
  let cleanedUp = false;

  const onPointerDown = (event: PointerEvent): void => {
    behavior.onPointerDown(event);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    behavior.onKeyDown(event);
  };

  behavior.setElement(input.element);
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
      behavior.cleanup();
      return;
    }

    element.removeEventListener("pointerdown", onPointerDown);

    if (keyDownAttached) {
      element.removeEventListener("keydown", onKeyDown);

      if (hadPreviousTabIndex) {
        element.setAttribute("tabindex", previousTabIndex ?? "");
      } else {
        element.removeAttribute("tabindex");
      }
    }

    behavior.cleanup();
  };

  runtime.onDispose(cleanup);
}
