import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import { setSortableCoordinator } from "../runtime/sortable-coordinator.js";
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
  remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

export type SortableRegistry = {
  registration: SortableRegistrationState;
  activeDrag: SortableActiveDragState;
};

export type SortableRegistrationState = {
  registrationAttributeSnapshots: Map<string, SortableAttributeSnapshot>;
  sortableElementIds: WeakMap<HTMLElement, SortableRegistrationIdentity>;
  sortableElementRefs: Map<string, WeakRef<HTMLElement>>;
  sortableOptions: Map<string, NormalizedSortableOptions>;
};

export type SortableRegistrationIdentity = {
  draggableId: string;
  group: string;
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
      sortableOptions: new Map(),
    },
    activeDrag: {
      previewPlacement: null,
      pointerMovement: null,
      snapshots: new Map(),
    },
  };

  setSortableCoordinator(runtime, {
    start: (event) => {
      initializeSortablePointerMovement(
        registry,
        event.movementPosition,
        event.placementPosition,
      );
      if (isActiveSortableRegistration(registry, runtime, event)) {
        snapshotSortableElement(registry, event.draggableId, event.group);
      }
    },
    update: (event) => {
      const isActiveSortable = isActiveSortableRegistration(
        registry,
        runtime,
        event,
      );

      if (
        isActiveSortable &&
        isSortablePreviewTarget({
          activeDropTargetId: event.activeDropTargetId,
        })
      ) {
        moveSortablePreview({
          registry,
          runtime,
          draggedDraggableId: event.draggableId,
          activeDropTargetId: event.activeDropTargetId,
          draggedGroup: event.group,
          placementPosition: event.placementPosition,
          movementPosition: event.movementPosition,
          options: getSortableOptions(registry, event.draggableId, event.group),
        });
      } else if (!isActiveSortable) {
        clearSortablePreviewPlacement(registry);
      }

      updateSortablePointerMovement(
        registry,
        event.movementPosition,
        event.placementPosition,
      );
    },
    release: ({ draggableId, group }) => {
      releaseSortableActiveDragState(registry, draggableId, group);
    },
  });

  sortableRegistries.set(runtime, registry);

  return registry;
}

function isActiveSortableRegistration(
  registry: SortableRegistry,
  runtime: DomSortableRuntime,
  input: { draggableId: string; group: string },
): boolean {
  const element = getRegisteredSortableElement(
    registry,
    input.draggableId,
    input.group,
  );
  const registration = runtime.getDropTargetRegistration(
    input.draggableId,
    input.group,
  );

  return (
    element !== null &&
    registration?.element === element &&
    registration.capabilities.sortable
  );
}

function releaseSortableActiveDragState(
  registry: SortableRegistry,
  draggableId: string,
  group: string,
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
    clearSortableDraggedState(registry, draggableId, group);
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
  const registrationKey = getSortableRegistrationKey(
    input.draggableId,
    input.group,
  );
  const existingSnapshot =
    input.registry.registration.registrationAttributeSnapshots.get(
      registrationKey,
    );
  const existingSnapshotElement = existingSnapshot?.elementRef.deref() ?? null;

  if (!existingSnapshot || existingSnapshotElement !== input.element) {
    input.registry.registration.registrationAttributeSnapshots.set(
      registrationKey,
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
  input.registry.registration.sortableElementIds.set(input.element, {
    draggableId: input.draggableId,
    group: input.group,
  });
  input.registry.registration.sortableElementRefs.set(
    registrationKey,
    new WeakRef(input.element),
  );
  input.registry.registration.sortableOptions.set(
    registrationKey,
    normalizedOptions,
  );
  input.runtime.registerDropTarget(
    input.draggableId,
    input.element,
    input.group,
    {
      containerId: input.containerId ?? null,
      sortable: true,
      sortableAxis: normalizedOptions.axis,
    },
  );
}

export function unregisterSortableElement(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggableId: string | null;
  group: string;
  element: HTMLElement | null;
}): void {
  if (input.draggableId !== null) {
    const registrationKey = getSortableRegistrationKey(
      input.draggableId,
      input.group,
    );
    input.runtime.unregisterDropTarget(
      input.draggableId,
      input.element ?? undefined,
    );
    const registeredElement =
      input.registry.registration.sortableElementRefs
        .get(registrationKey)
        ?.deref() ?? null;

    if (registeredElement === input.element || input.element === null) {
      if (registeredElement) {
        input.registry.registration.sortableElementIds.delete(
          registeredElement,
        );
      }

      input.registry.registration.sortableElementRefs.delete(registrationKey);
      input.registry.registration.sortableOptions.delete(registrationKey);
    }
  }

  if (input.element) {
    restoreSortableInternalAttributes({
      registry: input.registry,
      draggableId: input.draggableId,
      group: input.group,
      element: input.element,
    });
  }
}

export function restoreSortableInternalAttributes(input: {
  registry: SortableRegistry;
  draggableId: string | null;
  group: string;
  element: HTMLElement;
}): void {
  const snapshot = input.draggableId
    ? input.registry.registration.registrationAttributeSnapshots.get(
        getSortableRegistrationKey(input.draggableId, input.group),
      )
    : null;
  const snapshotElement = snapshot?.elementRef.deref() ?? null;

  restoreAttribute(
    input.element,
    "data-dnd-sortable-draggable",
    snapshot && snapshotElement === input.element
      ? snapshot.sortableDraggable
      : null,
  );
  restoreAttribute(
    input.element,
    "data-dnd-dragged",
    snapshot && snapshotElement === input.element ? snapshot.dragged : null,
  );

  if (input.draggableId) {
    input.registry.registration.registrationAttributeSnapshots.delete(
      getSortableRegistrationKey(input.draggableId, input.group),
    );
  }
}

export function restoreSortableDraggedAttribute(input: {
  registry: SortableRegistry;
  draggableId: string;
  group: string;
  element: HTMLElement;
}): void {
  const snapshot =
    input.registry.registration.registrationAttributeSnapshots.get(
      getSortableRegistrationKey(input.draggableId, input.group),
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
  group: string,
): HTMLElement | null {
  const element =
    registry.registration.sortableElementRefs
      .get(getSortableRegistrationKey(draggableId, group))
      ?.deref() ?? null;

  return element?.isConnected ? element : null;
}

function getSortableOptions(
  registry: SortableRegistry,
  draggableId: string,
  group: string,
): NormalizedSortableOptions {
  return (
    registry.registration.sortableOptions.get(
      getSortableRegistrationKey(draggableId, group),
    ) ?? normalizeSortableOptions(undefined)
  );
}

export function getSortableRegistrationKey(
  draggableId: string,
  group: string,
): string {
  return `${group}\u0000${draggableId}`;
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
