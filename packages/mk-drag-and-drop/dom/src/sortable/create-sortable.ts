import {
  createDomDraggable,
  type DomDraggableKeyDownEvent,
  type DomDraggablePointerDownEvent,
} from "../draggable/create-draggable.js";
import {
  getSortableRegistry,
  registerSortableElement,
  unregisterSortableElement,
  type DomSortableRuntime,
} from "./sortable-registry.js";

export type CreateDomSortableInput = {
  runtime: DomSortableRuntime;
  itemId: string;
  group?: string;
  getElement: () => HTMLElement | null;
};

export type DomSortableBehavior = {
  setElement: (element: HTMLElement | null) => void;
  cleanup: () => void;
  onPointerDown: (event: DomDraggablePointerDownEvent) => void;
  onKeyDown: (event: DomDraggableKeyDownEvent) => void;
  tabIndex: 0 | undefined;
};

const defaultSortableGroup = "default";

export function createDomSortable(
  input: CreateDomSortableInput,
): DomSortableBehavior {
  const group = input.group ?? defaultSortableGroup;
  const registry = getSortableRegistry(input.runtime);
  const draggable = createDomDraggable({
    runtime: input.runtime,
    itemId: input.itemId,
    group,
    getElement: input.getElement,
  });
  let registeredElement: HTMLElement | null = null;
  let registeredItemId: string | null = null;

  const cleanup = (): void => {
    unregisterSortableElement({
      registry,
      runtime: input.runtime,
      itemId: registeredItemId,
      element: registeredElement,
    });
    registeredElement = null;
    registeredItemId = null;
  };

  return {
    setElement: (element) => {
      if (
        element === registeredElement &&
        registeredItemId === input.itemId
      ) {
        return;
      }

      cleanup();

      if (!element) {
        return;
      }

      registerSortableElement({
        registry,
        runtime: input.runtime,
        itemId: input.itemId,
        group,
        element,
      });
      registeredElement = element;
      registeredItemId = input.itemId;
    },
    cleanup,
    onPointerDown: draggable.onPointerDown,
    onKeyDown: draggable.onKeyDown,
    tabIndex: draggable.tabIndex,
  };
}
