import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import {
  cancelSortableDropTargetGroupRemeasure,
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
    options?: {
      containerId?: string | null;
      kind?: "item" | "container";
    },
  ) => void;
  unregisterDropTarget: (itemId: string, element?: HTMLElement) => void;
  getDropTargetRegistration: (
    dropTargetId: string,
    group?: string,
    kind?: "item" | "container",
  ) => {
    id: string;
    element: HTMLElement;
    group: string;
    containerId: string | null;
    kind: "item" | "container";
  } | null;
  subscribe: (subscription: {
    onDragStart?: (event: { itemId: string }) => void;
    onDragUpdate?: (event: {
      itemId: string;
      pointerPosition: { x: number; y: number };
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
  onDispose?: (callback: () => void) => () => void;
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
  previousSibling: ChildNode | null;
  nextSibling: ChildNode | null;
  childIndex: number;
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

  const unsubscribe = runtime.subscribe({
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
        pointerPosition: event.pointerPosition,
      });
    },
    onDragEnd: (event) => {
      if (restoreSortableSnapshot(registry, event.itemId)) {
        remeasureSortableDropTargetGroup({
          registry,
          runtime,
          itemId: event.itemId,
        });
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
  let unsubscribeDispose: (() => void) | undefined;
  const cleanupRegistry = (): void => {
    unsubscribe();
    unsubscribeDispose?.();
    cancelSortableDropTargetGroupRemeasure(runtime);
    registry.elements.clear();
    registry.groups.clear();
    registry.snapshots.clear();
    sortableRegistries.delete(runtime);
  };

  unsubscribeDispose = runtime.onDispose?.(cleanupRegistry);

  sortableRegistries.set(runtime, registry);

  return registry;
}

export function registerSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  itemId: string;
  group: string;
  containerId?: string | null;
  element: HTMLElement;
}): void {
  input.element.dataset.dndSortableItem = "true";
  input.registry.elements.set(input.itemId, input.element);
  input.registry.groups.set(input.itemId, input.group);
  input.runtime.registerDropTarget(input.itemId, input.element, input.group, {
    containerId: input.containerId ?? null,
    kind: "item",
  });
}

export function unregisterSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  itemId: string | null;
  element: HTMLElement | null;
}): void {
  if (input.itemId !== null) {
    input.runtime.unregisterDropTarget(input.itemId, input.element ?? undefined);

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
