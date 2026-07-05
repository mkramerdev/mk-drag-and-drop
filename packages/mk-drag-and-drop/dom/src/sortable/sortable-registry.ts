import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import {
  cancelSortableDropTargetGroupRemeasure,
  clearSortableDraggedState,
  clearSortablePointerMovement,
  initializeSortablePointerMovement,
  moveSortablePreview,
  remeasureSortableDropTargetGroup,
  restoreSortableSnapshot,
  snapshotSortableElement,
  isSortablePreviewTarget,
  type SortablePointerMovementState,
  updateSortablePointerMovement,
} from "./sortable-preview.js";

export type DomSortableRuntime = DomDraggableRuntime & {
  registerDropTarget: (
    draggableId: string,
    element: HTMLElement,
    group: string,
    options?: {
      containerId?: string | null;
      sortable?: boolean;
    },
  ) => void;
  unregisterDropTarget: (draggableId: string, element?: HTMLElement) => void;
  getDropTargetRegistration: (
    dropTargetId: string,
    group?: string,
  ) => {
    id: string;
    element: HTMLElement;
    group: string;
    containerId: string | null;
    capabilities: {
      container: boolean;
      sortable: boolean;
    };
  } | null;
  subscribe: (subscription: {
    onDragStart?: (event: {
      draggableId: string;
      pointerPosition: { x: number; y: number };
    }) => void;
    onDragUpdate?: (event: {
      draggableId: string;
      pointerPosition: { x: number; y: number };
      placementPosition?: { x: number; y: number };
      activeDropTarget: string | null;
      previousDropTarget: string | null;
    }) => void;
    onDragEnd?: (event: {
      draggableId: string;
      dropTarget: string | null;
    }) => void;
    onDrop?: (event: {
      draggableId: string;
      dropTarget: string;
    }) => void;
  }) => () => void;
  onDispose?: (callback: () => void) => () => void;
  remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

export type SortableRegistry = {
  attributeSnapshots: Map<string, SortableAttributeSnapshot>;
  elementIds: WeakMap<HTMLElement, string>;
  elements: Map<string, WeakRef<HTMLElement>>;
  groups: Map<string, string>;
  pointerMovement: SortablePointerMovementState | null;
  snapshots: Map<string, SortableSnapshot>;
};

export type SortableAttributeSnapshot = {
  elementRef: WeakRef<HTMLElement>;
  sortableDraggable: string | null;
  dragged: string | null;
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
    attributeSnapshots: new Map(),
    elementIds: new WeakMap(),
    elements: new Map(),
    groups: new Map(),
    pointerMovement: null,
    snapshots: new Map(),
  };

  const unsubscribe = runtime.subscribe({
    onDragStart: (event) => {
      initializeSortablePointerMovement(registry, event.pointerPosition);
      snapshotSortableElement(registry, event.draggableId);
    },
    onDragUpdate: (event) => {
      if (
        isSortablePreviewTarget({
          draggedDraggableId: event.draggableId,
          activeDropTarget: event.activeDropTarget,
        })
      ) {
        moveSortablePreview({
          registry,
          runtime,
          draggedDraggableId: event.draggableId,
          activeDropTarget: event.activeDropTarget,
          pointerPosition: event.pointerPosition,
          placementPosition: event.placementPosition ?? event.pointerPosition,
        });
      }

      updateSortablePointerMovement(registry, event.pointerPosition);
    },
    onDragEnd: (event) => {
      if (restoreSortableSnapshot(registry, event.draggableId)) {
        remeasureSortableDropTargetGroup({
          registry,
          runtime,
          draggableId: event.draggableId,
        });
      }

      clearSortableDraggedState(registry, event.draggableId);
      clearSortablePointerMovement(registry);
      registry.snapshots.delete(event.draggableId);
    },
    onDrop: (event) => {
      clearSortableDraggedState(registry, event.draggableId);
      clearSortablePointerMovement(registry);
      registry.snapshots.delete(event.draggableId);
      remeasureSortableDropTargetGroup({
        registry,
        runtime,
        draggableId: event.draggableId,
      });
    },
  });
  const cleanupRegistry = (): void => {
    unsubscribe();
    unsubscribeDispose?.();
    cancelSortableDropTargetGroupRemeasure(runtime);
    registry.elements.clear();
    registry.groups.clear();
    registry.pointerMovement = null;
    registry.attributeSnapshots.clear();
    registry.snapshots.clear();
    sortableRegistries.delete(runtime);
  };
  const unsubscribeDispose = runtime.onDispose?.(cleanupRegistry);

  sortableRegistries.set(runtime, registry);

  return registry;
}

export function registerSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggableId: string;
  group: string;
  containerId?: string | null;
  element: HTMLElement;
}): void {
  const existingSnapshot = input.registry.attributeSnapshots.get(input.draggableId);
  const existingSnapshotElement = existingSnapshot?.elementRef.deref() ?? null;

  if (!existingSnapshot || existingSnapshotElement !== input.element) {
    input.registry.attributeSnapshots.set(input.draggableId, {
      elementRef: new WeakRef(input.element),
      sortableDraggable: input.element.getAttribute("data-dnd-sortable-draggable"),
      dragged: input.element.getAttribute("data-dnd-dragged"),
    });
  }

  input.element.setAttribute("data-dnd-sortable-draggable", "true");
  input.registry.elementIds.set(input.element, input.draggableId);
  input.registry.elements.set(input.draggableId, new WeakRef(input.element));
  input.registry.groups.set(input.draggableId, input.group);
  input.runtime.registerDropTarget(input.draggableId, input.element, input.group, {
    containerId: input.containerId ?? null,
    sortable: true,
  });
}

export function unregisterSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggableId: string | null;
  element: HTMLElement | null;
}): void {
  if (input.draggableId !== null) {
    input.runtime.unregisterDropTarget(input.draggableId, input.element ?? undefined);
    const registeredElement =
      input.registry.elements.get(input.draggableId)?.deref() ?? null;

    if (registeredElement === input.element || input.element === null) {
      if (registeredElement) {
        input.registry.elementIds.delete(registeredElement);
      }

      input.registry.elements.delete(input.draggableId);
      input.registry.groups.delete(input.draggableId);
    }
  }

  if (input.element) {
    restoreSortableInternalAttributes({
      registry: input.registry,
      draggableId: input.draggableId,
      element: input.element,
    });
  }
}

export function restoreSortableInternalAttributes(input: {
  registry: SortableRegistry;
  draggableId: string | null;
  element: HTMLElement;
}): void {
  const snapshot = input.draggableId
    ? input.registry.attributeSnapshots.get(input.draggableId)
    : null;
  const snapshotElement = snapshot?.elementRef.deref() ?? null;

  restoreAttribute(
    input.element,
    "data-dnd-sortable-draggable",
    snapshot && snapshotElement === input.element ? snapshot.sortableDraggable : null,
  );
  restoreAttribute(
    input.element,
    "data-dnd-dragged",
    snapshot && snapshotElement === input.element ? snapshot.dragged : null,
  );

  if (input.draggableId) {
    input.registry.attributeSnapshots.delete(input.draggableId);
  }
}

export function restoreSortableDraggedAttribute(input: {
  registry: SortableRegistry;
  draggableId: string;
  element: HTMLElement;
}): void {
  const snapshot = input.registry.attributeSnapshots.get(input.draggableId);
  const snapshotElement = snapshot?.elementRef.deref() ?? null;

  restoreAttribute(
    input.element,
    "data-dnd-dragged",
    snapshot && snapshotElement === input.element ? snapshot.dragged : null,
  );
}

export function getRegisteredSortableElement(
  registry: SortableRegistry,
  draggableId: string,
): HTMLElement | null {
  const element = registry.elements.get(draggableId)?.deref() ?? null;

  return element?.isConnected ? element : null;
}

function restoreAttribute(
  element: HTMLElement,
  attribute: string,
  value: string | null,
): void {
  if (value === null) {
    element.removeAttribute(attribute);
    return;
  }

  element.setAttribute(attribute, value);
}
