import type { DragController } from "../controller/create-drag-controller.js";
import { createDomSortable } from "./create-sortable.js";

export type CreateSortableInput = {
  controller: DragController;
  element: HTMLElement;
  itemId: string;
  group?: string;
  containerId?: string | null;
};

export type CreateSortableCleanup = () => void;

const defaultSortableGroup = "default";

export function createSortable(
  input: CreateSortableInput,
): CreateSortableCleanup {
  const behavior = createDomSortable({
    runtime: input.controller.runtime,
    itemId: input.itemId,
    group: input.group ?? defaultSortableGroup,
    containerId: input.containerId ?? null,
    getElement: () => input.element,
  });
  const hadPreviousTabIndex = input.element.hasAttribute("tabindex");
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
    input.element.removeEventListener("pointerdown", onPointerDown);

    if (keyDownAttached) {
      input.element.removeEventListener("keydown", onKeyDown);

      if (hadPreviousTabIndex) {
        input.element.setAttribute("tabindex", previousTabIndex ?? "");
      } else {
        input.element.removeAttribute("tabindex");
      }
    }

    behavior.cleanup();

    const unsubscribe = disposeCleanup;
    disposeCleanup = null;
    unsubscribe?.();
  };

  disposeCleanup = input.controller.runtime.onDispose(cleanup);

  return cleanup;
}
