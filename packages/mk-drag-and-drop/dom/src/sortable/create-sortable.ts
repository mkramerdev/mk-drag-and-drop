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
import type { SortableOptions } from "./sortable-options.js";

export type CreateDomSortableInput = SortableOptions & {
  runtime: DomSortableRuntime;
  draggableId: string;
  group?: string;
  containerId?: string | null;
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
    draggableId: input.draggableId,
    group,
    getElement: input.getElement,
  });
  let registeredElementRef: WeakRef<HTMLElement> | null = null;
  let registeredDraggableId: string | null = null;

  const cleanup = (): void => {
    const registeredElement = registeredElementRef?.deref() ?? null;

    unregisterSortableElement({
      registry,
      runtime: input.runtime,
      draggableId: registeredDraggableId,
      element: registeredElement,
    });
    registeredElementRef = null;
    registeredDraggableId = null;
  };

  return {
    setElement: (element) => {
      const registeredElement = registeredElementRef?.deref() ?? null;

      if (
        element === registeredElement &&
        registeredDraggableId === input.draggableId
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
        draggableId: input.draggableId,
        group,
        containerId: input.containerId ?? null,
        element,
        options: input,
      });
      registeredElementRef = new WeakRef(element);
      registeredDraggableId = input.draggableId;
    },
    cleanup,
    onPointerDown: draggable.onPointerDown,
    onKeyDown: draggable.onKeyDown,
    tabIndex: draggable.tabIndex,
  };
}
