import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import {
  clearSortableDraggedState,
  moveSortablePreview,
  remeasureSortableDropTargetGroup,
  restoreSortableSnapshot,
  snapshotSortableElement,
  isSortablePreviewTarget,
} from "./sortable-preview.js";

export type DomSortableRuntime = DomDraggableRuntime & {
  registerDropTarget: (
    itemId: string,
    element: HTMLElement,
    group: string,
  ) => void;
  unregisterDropTarget: (itemId: string) => void;
  subscribe: (subscription: {
    onDragStart?: (event: { itemId: string }) => void;
    onDragUpdate?: (event: {
      itemId: string;
      activeDropTarget: string | null;
      previousDropTarget: string | null;
    }) => void;
    onDragEnd?: (event: {
      itemId: string;
      dropTarget: string | null;
    }) => void;
    onDrop?: (event: {
      itemId: string;
      dropTarget: string;
    }) => void;
  }) => () => void;
  remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

export type SortableRegistry = {
  elements: Map<string, HTMLElement>;
  groups: Map<string, string>;
  snapshots: Map<string, SortableSnapshot>;
};

export type SortableSnapshot = {
  element: HTMLElement;
  parent: HTMLElement;
  nextSibling: ChildNode | null;
};

const sortableRegistries = new WeakMap<DomSortableRuntime, SortableRegistry>();

export function getSortableRegistry(
  runtime: DomSortableRuntime,
): SortableRegistry {
  const existingRegistry = sortableRegistries.get(runtime);

  if (existingRegistry) {
    return existingRegistry;
  }

  const registry: SortableRegistry = {
    elements: new Map(),
    groups: new Map(),
    snapshots: new Map(),
  };

  runtime.subscribe({
    onDragStart: (event) => {
      snapshotSortableElement(registry, event.itemId);
    },
    onDragUpdate: (event) => {
      if (
        !isSortablePreviewTarget({
          draggedItemId: event.itemId,
          activeDropTarget: event.activeDropTarget,
        })
      ) {
        return;
      }

      moveSortablePreview({
        registry,
        runtime,
        draggedItemId: event.itemId,
        activeDropTarget: event.activeDropTarget,
      });
    },
    onDragEnd: (event) => {
      if (event.dropTarget === null) {
        if (restoreSortableSnapshot(registry, event.itemId)) {
          remeasureSortableDropTargetGroup({
            registry,
            runtime,
            itemId: event.itemId,
          });
        }
      }

      clearSortableDraggedState(registry, event.itemId);
      registry.snapshots.delete(event.itemId);
    },
    onDrop: (event) => {
      clearSortableDraggedState(registry, event.itemId);
      registry.snapshots.delete(event.itemId);
      remeasureSortableDropTargetGroup({
        registry,
        runtime,
        itemId: event.itemId,
      });
    },
  });

  sortableRegistries.set(runtime, registry);

  return registry;
}

export function registerSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  itemId: string;
  group: string;
  element: HTMLElement;
}): void {
  input.element.dataset.dndSortableItem = "true";
  input.registry.elements.set(input.itemId, input.element);
  input.registry.groups.set(input.itemId, input.group);
  input.runtime.registerDropTarget(input.itemId, input.element, input.group);
}

export function unregisterSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  itemId: string | null;
  element: HTMLElement | null;
}): void {
  if (input.itemId !== null) {
    input.runtime.unregisterDropTarget(input.itemId);

    if (input.registry.elements.get(input.itemId) === input.element) {
      input.registry.elements.delete(input.itemId);
      input.registry.groups.delete(input.itemId);
    }
  }

  if (input.element) {
    delete input.element.dataset.dndSortableItem;
    delete input.element.dataset.dndDragged;
  }
}
