import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import {
  clearSortableDraggedState,
  clearSortablePointerMovement,
  initializeSortablePointerMovement,
  moveSortablePreview,
  restoreSortableSnapshot,
  snapshotSortableElement,
  isSortablePreviewTarget,
  type SortablePreviewPlacementState,
  type SortablePointerMovementState,
  updateSortablePointerMovement,
  clearSortablePreviewPlacement,
} from "./sortable-preview.js";
import {
  normalizeSortableOptions,
  type NormalizedSortableOptions,
  type SortableOptions,
} from "./sortable-options.js";

export type DomSortableRuntime = DomDraggableRuntime & {
  registerDropTarget: (
    draggableId: string,
    element: HTMLElement,
    group: string,
    options?: {
      containerId?: string | null;
      sortable?: boolean;
      sortableAxis?: NormalizedSortableOptions["axis"];
    },
  ) => void;
  registerDropContainer?: (
    containerId: string,
    element: HTMLElement,
    group: string,
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
      source: "pointer" | "keyboard";
      pointerPosition: { x: number; y: number };
      placementPosition?: { x: number; y: number };
    }) => void;
    onDragUpdate?: (event: {
      draggableId: string;
      source: "pointer" | "keyboard";
      pointerPosition: { x: number; y: number };
      placementPosition?: { x: number; y: number };
      activeDropTargetId: string | null;
      previousDropTargetId: string | null;
    }) => void;
    onDragEnd?: (event: {
      draggableId: string;
      source: "pointer" | "keyboard";
      result: "dropped" | "no-target" | "invalid-target" | "canceled";
      dropTargetId: string | null;
    }) => void;
    onDrop?: (event: {
      draggableId: string;
      source: "pointer" | "keyboard";
      dropTargetId: string;
    }) => void;
    onActiveDragReset?: (event: {
      draggableId: string;
      source: "pointer" | "keyboard";
    }) => void;
  }) => () => void;
  remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

export type SortableRegistry = {
  registration: SortableRegistrationState;
  activeDrag: SortableActiveDragState;
};

export type SortableRegistrationState = {
  registrationAttributeSnapshots: Map<string, SortableAttributeSnapshot>;
  sortableElementIds: WeakMap<HTMLElement, string>;
  sortableElementRefs: Map<string, WeakRef<HTMLElement>>;
  sortableGroups: Map<string, string>;
  sortableOptions: Map<string, NormalizedSortableOptions>;
};

export type SortableActiveDragState = {
  previewPlacement: SortablePreviewPlacementState | null;
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
    registration: {
      registrationAttributeSnapshots: new Map(),
      sortableElementIds: new WeakMap(),
      sortableElementRefs: new Map(),
      sortableGroups: new Map(),
      sortableOptions: new Map(),
    },
    activeDrag: {
      previewPlacement: null,
      pointerMovement: null,
      snapshots: new Map(),
    },
  };

  runtime.subscribe({
    onDragStart: (event) => {
      initializeSortablePointerMovement(
        registry,
        event.placementPosition ?? event.pointerPosition,
      );
      snapshotSortableElement(registry, event.draggableId);
    },
    onDragUpdate: (event) => {
      if (
        isSortablePreviewTarget({
          activeDropTargetId: event.activeDropTargetId,
        })
      ) {
        moveSortablePreview({
          registry,
          runtime,
          draggedDraggableId: event.draggableId,
          activeDropTargetId: event.activeDropTargetId,
          pointerPosition: event.pointerPosition,
          placementPosition: event.placementPosition ?? event.pointerPosition,
          options: getSortableOptions(registry, event.draggableId),
        });
      } else {
        clearSortablePreviewPlacement(registry);
      }

      updateSortablePointerMovement(
        registry,
        event.placementPosition ?? event.pointerPosition,
      );
    },
    onDragEnd: (event) => {
      releaseSortableActiveDragState(registry, event.draggableId);
    },
    onDrop: (event) => {
      releaseSortableActiveDragState(registry, event.draggableId);
    },
    onActiveDragReset: (event) => {
      releaseSortableActiveDragState(registry, event.draggableId);
    },
  });

  sortableRegistries.set(runtime, registry);

  return registry;
}

function releaseSortableActiveDragState(
  registry: SortableRegistry,
  draggableId: string,
): void {
  let releaseError: unknown;
  let hasReleaseError = false;

  try {
    restoreSortableSnapshot(registry, draggableId);
  } catch (error) {
    releaseError = error;
    hasReleaseError = true;
  }

  try {
    clearSortableDraggedState(registry, draggableId);
  } catch (error) {
    if (!hasReleaseError) {
      releaseError = error;
      hasReleaseError = true;
    }
  } finally {
    clearSortablePointerMovement(registry);
    clearSortablePreviewPlacement(registry);
    registry.activeDrag.snapshots.delete(draggableId);
  }

  if (hasReleaseError) {
    throw releaseError;
  }
}

export function registerSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggableId: string;
  group: string;
  containerId?: string | null;
  element: HTMLElement;
  options?: SortableOptions;
}): void {
  const existingSnapshot =
    input.registry.registration.registrationAttributeSnapshots.get(
      input.draggableId,
    );
  const existingSnapshotElement = existingSnapshot?.elementRef.deref() ?? null;

  if (!existingSnapshot || existingSnapshotElement !== input.element) {
    input.registry.registration.registrationAttributeSnapshots.set(
      input.draggableId,
      {
        elementRef: new WeakRef(input.element),
        sortableDraggable: input.element.getAttribute(
          "data-dnd-sortable-draggable",
        ),
        dragged: input.element.getAttribute("data-dnd-dragged"),
      },
    );
  }

  input.element.setAttribute("data-dnd-sortable-draggable", "true");
  const normalizedOptions = normalizeSortableOptions(input.options);
  input.registry.registration.sortableElementIds.set(
    input.element,
    input.draggableId,
  );
  input.registry.registration.sortableElementRefs.set(
    input.draggableId,
    new WeakRef(input.element),
  );
  input.registry.registration.sortableGroups.set(input.draggableId, input.group);
  input.registry.registration.sortableOptions.set(
    input.draggableId,
    normalizedOptions,
  );
  input.runtime.registerDropTarget(input.draggableId, input.element, input.group, {
    containerId: input.containerId ?? null,
    sortable: true,
    sortableAxis: normalizedOptions.axis,
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
      input.registry.registration.sortableElementRefs
        .get(input.draggableId)
        ?.deref() ?? null;

    if (registeredElement === input.element || input.element === null) {
      if (registeredElement) {
        input.registry.registration.sortableElementIds.delete(registeredElement);
      }

      input.registry.registration.sortableElementRefs.delete(input.draggableId);
      input.registry.registration.sortableGroups.delete(input.draggableId);
      input.registry.registration.sortableOptions.delete(input.draggableId);
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
    ? input.registry.registration.registrationAttributeSnapshots.get(
        input.draggableId,
      )
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
    input.registry.registration.registrationAttributeSnapshots.delete(
      input.draggableId,
    );
  }
}

export function restoreSortableDraggedAttribute(input: {
  registry: SortableRegistry;
  draggableId: string;
  element: HTMLElement;
}): void {
  const snapshot =
    input.registry.registration.registrationAttributeSnapshots.get(
      input.draggableId,
    );
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
  const element =
    registry.registration.sortableElementRefs.get(draggableId)?.deref() ?? null;

  return element?.isConnected ? element : null;
}

function getSortableOptions(
  registry: SortableRegistry,
  draggableId: string,
): NormalizedSortableOptions {
  return (
    registry.registration.sortableOptions.get(draggableId) ??
    normalizeSortableOptions(undefined)
  );
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
