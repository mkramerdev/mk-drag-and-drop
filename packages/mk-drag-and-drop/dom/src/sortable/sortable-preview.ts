import type {
  DomSortableRuntime,
  SortableRegistry,
  SortableSnapshot,
} from "./sortable-registry.js";
import {
  getRegisteredSortableElement,
  restoreSortableDraggedAttribute,
} from "./sortable-registry.js";
import type {
  NormalizedSortableOptions,
  SortableAxis,
} from "./sortable-options.js";

export type SortablePlacementSide = "before" | "after";
export type SortableAxisMovementDirection = "forward" | "backward" | "none";
export type SortablePointerMovementState = {
  previousPointerPosition: { x: number; y: number };
};
export type SortablePreviewPlacementState = {
  activeDropTargetId: string | null;
  placement: SortablePlacementSide | null;
  movementDirection: SortableAxisMovementDirection;
  containerElement: HTMLElement | null;
  pendingMidpointInitialPlacement: boolean;
};
export type SortablePreviewPlacementDecision = {
  placement: SortablePlacementSide;
  movementDirection: SortableAxisMovementDirection;
};

const neutralPlacementBoundaryRatio = 0.5;

export function snapshotSortableElement(
  registry: SortableRegistry,
  draggableId: string,
): void {
  const element = getRegisteredSortableElement(registry, draggableId);

  if (!element?.parentElement) {
    return;
  }

  element.dataset.dndDragged = "true";
  registry.activeDrag.snapshots.set(draggableId, {
    element,
    parent: element.parentElement,
    previousSibling: element.previousSibling,
    nextSibling: element.nextSibling,
    childIndex: Array.prototype.indexOf.call(
      element.parentElement.childNodes,
      element,
    ) as number,
  });
}

export function isSortablePreviewTarget(input: {
  activeDropTargetId: string | null;
}): boolean {
  return input.activeDropTargetId !== null;
}

export function initializeSortablePointerMovement(
  registry: SortableRegistry,
  pointerPosition: { x: number; y: number },
): void {
  registry.activeDrag.pointerMovement = {
    previousPointerPosition: { ...pointerPosition },
  };
  registry.activeDrag.previewPlacement = null;
}

export function updateSortablePointerMovement(
  registry: SortableRegistry,
  pointerPosition: { x: number; y: number },
): void {
  const movement = registry.activeDrag.pointerMovement;

  if (!movement) {
    initializeSortablePointerMovement(registry, pointerPosition);
    return;
  }

  movement.previousPointerPosition = { ...pointerPosition };
}

export function clearSortablePointerMovement(registry: SortableRegistry): void {
  registry.activeDrag.pointerMovement = null;
}

export function clearSortablePreviewPlacement(registry: SortableRegistry): void {
  registry.activeDrag.previewPlacement = null;
}

export function moveSortablePreview(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggedDraggableId: string;
  activeDropTargetId: string | null;
  placementPosition: { x: number; y: number };
  options: NormalizedSortableOptions;
}): void {
  if (input.activeDropTargetId === null) {
    return;
  }

  const draggedElement = getRegisteredSortableElement(
    input.registry,
    input.draggedDraggableId,
  );
  const draggedGroup = input.registry.registration.sortableGroups.get(
    input.draggedDraggableId,
  );

  if (!draggedElement || !draggedGroup) {
    return;
  }

  const activeDropTargetId =
    input.activeDropTargetId === input.draggedDraggableId
      ? input.registry.activeDrag.previewPlacement?.activeDropTargetId
      : input.activeDropTargetId;

  if (
    !activeDropTargetId ||
    activeDropTargetId === input.draggedDraggableId
  ) {
    refreshSortableDropTargetMeasurements({
      registry: input.registry,
      runtime: input.runtime,
      group: draggedGroup,
      dropTargetIds: getSortablePreviewMeasurementIds({
        registry: input.registry,
        draggedElement,
      }),
    });
    return;
  }

  const target = input.runtime.getDropTargetRegistration(
    activeDropTargetId,
    draggedGroup,
  );

  if (!target) {
    return;
  }

  const measurementIds = getSortablePreviewMeasurementIds({
    registry: input.registry,
    draggedElement,
    targetElement: target.element,
  });
  const draggedRegistration = input.runtime.getDropTargetRegistration(
    input.draggedDraggableId,
    draggedGroup,
  );

  addRegistrationContainerId(measurementIds, draggedRegistration);
  addRegistrationContainerId(measurementIds, target);

  if (target.capabilities.container) {
    measurementIds.add(target.id);
    const previousListElement =
      input.registry.activeDrag.previewPlacement?.containerElement ?? null;
    const pendingMidpointInitialPlacement =
      draggedElement.parentElement !== target.element ||
      (previousListElement !== null && previousListElement !== target.element);

    setSortablePreviewPlacementState({
      registry: input.registry,
      activeDropTargetId: target.id,
      placement: null,
      containerElement: target.element,
      pendingMidpointInitialPlacement,
      movementDirection: getCurrentAxisMovementDirection({
        placementPosition: input.placementPosition,
        movement: input.registry.activeDrag.pointerMovement,
        axis: input.options.axis,
      }),
    });

    if (!moveSortablePreviewIntoContainer({
      draggedElement,
      targetElement: target.element,
    })) {
      return;
    }

    addSortableMeasurementIdsAroundElement(
      measurementIds,
      input.registry,
      draggedElement,
    );
    refreshSortableDropTargetMeasurements({
      registry: input.registry,
      runtime: input.runtime,
      group: draggedGroup,
      dropTargetIds: measurementIds,
    });
    return;
  }

  const targetElement = target.element;
  const listElement = targetElement.parentElement;

  if (!listElement) {
    return;
  }

  const previousPlacement = input.registry.activeDrag.previewPlacement;
  const previousListElement = previousPlacement?.containerElement ?? null;
  const useMidpointInitialPlacement =
    draggedElement.parentElement !== listElement ||
    (previousListElement !== null && previousListElement !== listElement) ||
    (previousPlacement?.placement === null &&
      previousPlacement.pendingMidpointInitialPlacement &&
      previousListElement === listElement);

  if (!target.capabilities.sortable) {
    return;
  }

  const targetDraggableId = getSortableDraggableId(
    input.registry,
    targetElement,
  );

  if (targetDraggableId !== activeDropTargetId) {
    return;
  }

  const placementDecision = getSortablePreviewPlacement({
    activeDropTargetId,
    targetElement,
    placementPosition: input.placementPosition,
    movement: input.registry.activeDrag.pointerMovement,
    previewPlacement: input.registry.activeDrag.previewPlacement,
    options: input.options,
    useMidpointInitialPlacement,
  });
  const placement = placementDecision.placement;

  setSortablePreviewPlacementState({
    registry: input.registry,
    activeDropTargetId,
    placement,
    movementDirection: placementDecision.movementDirection,
    containerElement: listElement,
    pendingMidpointInitialPlacement: false,
  });

  if (
    isSortablePreviewAlreadyPlaced({
      draggedElement,
      targetElement,
      placement,
    })
  ) {
    return;
  }

  if (placement === "after") {
    targetElement.after(draggedElement);
  } else {
    targetElement.before(draggedElement);
  }

  addSortableMeasurementIdsAroundElement(
    measurementIds,
    input.registry,
    draggedElement,
  );
  addSortableMeasurementIdsAroundElement(
    measurementIds,
    input.registry,
    targetElement,
  );
  refreshSortableDropTargetMeasurements({
    registry: input.registry,
    runtime: input.runtime,
    group: draggedGroup,
    dropTargetIds: measurementIds,
  });
}

export function getSortablePreviewPlacement(input: {
  activeDropTargetId: string;
  targetElement: HTMLElement;
  placementPosition: { x: number; y: number };
  movement: SortablePointerMovementState | null;
  previewPlacement: SortablePreviewPlacementState | null;
  options: NormalizedSortableOptions;
  useMidpointInitialPlacement?: boolean;
}): SortablePreviewPlacementDecision {
  const axis = input.options.axis;
  const axisPosition = getAxisPosition(input.placementPosition, axis);
  const targetRect = input.targetElement.getBoundingClientRect();
  const currentDirection = getCurrentAxisMovementDirection({
    placementPosition: input.placementPosition,
    movement: input.movement,
    axis,
  });
  const previousPlacement = input.previewPlacement;

  if (
    !previousPlacement ||
    previousPlacement.activeDropTargetId !== input.activeDropTargetId ||
    previousPlacement.placement === null ||
    previousPlacement.movementDirection === "none"
  ) {
    if (input.useMidpointInitialPlacement) {
      const placement = getPlacementSideFromTargetMidpoint({
        axis,
        axisPosition,
        targetRect,
      });

      return {
        placement,
        movementDirection: getMovementDirectionFromPlacementSide(placement),
      };
    }

    return {
      placement: getOptimisticPlacement({
        axis,
        axisPosition,
        currentDirection,
        targetRect,
      }),
      movementDirection: currentDirection,
    };
  }

  if (
    currentDirection === "none" ||
    currentDirection === previousPlacement.movementDirection
  ) {
    return {
      placement: previousPlacement.placement,
      movementDirection: previousPlacement.movementDirection,
    };
  }

  const boundary = getPlacementBoundary({
    targetRect,
    axis,
    direction: currentDirection,
    startRatio: input.options.placementBoundary.start,
    endRatio: input.options.placementBoundary.end,
  });
  const reversalPlacement = getPlacementSideFromBoundary(axisPosition, boundary);

  if (reversalPlacement === previousPlacement.placement) {
    return {
      placement: previousPlacement.placement,
      movementDirection: previousPlacement.movementDirection,
    };
  }

  return {
    placement: reversalPlacement,
    movementDirection: currentDirection,
  };
}

function setSortablePreviewPlacementState(input: {
  registry: SortableRegistry;
  activeDropTargetId: string;
  placement: SortablePlacementSide | null;
  movementDirection: SortableAxisMovementDirection;
  containerElement: HTMLElement | null;
  pendingMidpointInitialPlacement: boolean;
}): void {
  input.registry.activeDrag.previewPlacement = {
    activeDropTargetId: input.activeDropTargetId,
    placement: input.placement,
    movementDirection: input.movementDirection,
    containerElement: input.containerElement,
    pendingMidpointInitialPlacement: input.pendingMidpointInitialPlacement,
  };
}

function getOptimisticPlacement(input: {
  axis: SortableAxis;
  axisPosition: number;
  currentDirection: SortableAxisMovementDirection;
  targetRect: DOMRect;
}): SortablePlacementSide {
  if (input.currentDirection === "forward") {
    return "after";
  }

  if (input.currentDirection === "backward") {
    return "before";
  }

  return getPlacementSideFromBoundary(
    input.axisPosition,
    getPlacementBoundary({
      targetRect: input.targetRect,
      axis: input.axis,
      direction: "none",
      startRatio: neutralPlacementBoundaryRatio,
      endRatio: neutralPlacementBoundaryRatio,
    }),
  );
}

function getPlacementSideFromTargetMidpoint(input: {
  axis: SortableAxis;
  axisPosition: number;
  targetRect: DOMRect;
}): SortablePlacementSide {
  const targetStart =
    input.axis === "horizontal" ? input.targetRect.left : input.targetRect.top;
  const targetSize =
    input.axis === "horizontal" ? input.targetRect.width : input.targetRect.height;
  const midpoint = targetStart + targetSize / 2;

  return input.axisPosition < midpoint ? "before" : "after";
}

function getMovementDirectionFromPlacementSide(
  placement: SortablePlacementSide,
): SortableAxisMovementDirection {
  return placement === "before" ? "backward" : "forward";
}

function getCurrentAxisMovementDirection(input: {
  placementPosition: { x: number; y: number };
  movement: SortablePointerMovementState | null;
  axis: SortableAxis;
}): SortableAxisMovementDirection {
  const axisPosition = getAxisPosition(input.placementPosition, input.axis);
  const previousAxisPosition = input.movement
    ? getAxisPosition(input.movement.previousPointerPosition, input.axis)
    : axisPosition;

  return getAxisMovementDirection(previousAxisPosition, axisPosition);
}

export function isSortablePreviewAlreadyPlaced(input: {
  draggedElement: HTMLElement;
  targetElement: HTMLElement;
  placement: SortablePlacementSide;
}): boolean {
  return input.placement === "before"
    ? input.draggedElement.nextElementSibling === input.targetElement
    : input.draggedElement.previousElementSibling === input.targetElement;
}

export function restoreSortableSnapshot(
  registry: SortableRegistry,
  draggableId: string,
): boolean {
  const snapshot = registry.activeDrag.snapshots.get(draggableId);

  if (!snapshot) {
    return false;
  }

  snapshot.parent.insertBefore(
    snapshot.element,
    getSnapshotRestoreReferenceNode(snapshot),
  );
  return true;
}

export function clearSortableDraggedState(
  registry: SortableRegistry,
  draggableId: string,
): void {
  const element =
    getRegisteredSortableElement(registry, draggableId) ??
    registry.activeDrag.snapshots.get(draggableId)?.element;

  if (element) {
    restoreSortableDraggedAttribute({
      registry,
      draggableId,
      element,
    });
  }
}

function getSortableDraggableId(
  registry: SortableRegistry,
  element: HTMLElement,
): string | null {
  const draggableId = registry.registration.sortableElementIds.get(element);

  return (
    draggableId &&
      registry.registration.sortableElementRefs.get(draggableId)?.deref() ===
        element
  )
    ? draggableId
    : null;
}

function getSortablePreviewMeasurementIds(input: {
  registry: SortableRegistry;
  draggedElement: HTMLElement;
  targetElement?: HTMLElement;
}): Set<string> {
  const dropTargetIds = new Set<string>();

  addSortableMeasurementIdsAroundElement(
    dropTargetIds,
    input.registry,
    input.draggedElement,
  );

  if (input.targetElement) {
    addSortableMeasurementIdsAroundElement(
      dropTargetIds,
      input.registry,
      input.targetElement,
    );
  }

  return dropTargetIds;
}

function addSortableMeasurementIdsAroundElement(
  dropTargetIds: Set<string>,
  registry: SortableRegistry,
  element: HTMLElement,
): void {
  addSortableMeasurementId(dropTargetIds, registry, element);
  addSortableMeasurementId(
    dropTargetIds,
    registry,
    element.previousElementSibling,
  );
  addSortableMeasurementId(
    dropTargetIds,
    registry,
    element.nextElementSibling,
  );
}

function addSortableMeasurementId(
  dropTargetIds: Set<string>,
  registry: SortableRegistry,
  element: Element | null,
): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const draggableId = getSortableDraggableId(registry, element);

  if (draggableId) {
    dropTargetIds.add(draggableId);
  }
}

function addRegistrationContainerId(
  dropTargetIds: Set<string>,
  registration: ReturnType<DomSortableRuntime["getDropTargetRegistration"]>,
): void {
  if (registration?.containerId) {
    dropTargetIds.add(registration.containerId);
  }
}


function refreshSortableDropTargetMeasurements(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  group: string;
  dropTargetIds: ReadonlySet<string>;
}): void {
  for (const dropTargetId of input.dropTargetIds) {
    const registration = input.runtime.getDropTargetRegistration(
      dropTargetId,
      input.group,
    );

    if (!registration) {
      continue;
    }

    if (registration.capabilities.container) {
      input.runtime.registerDropContainer?.(
        registration.id,
        registration.element,
        registration.group,
      );
      continue;
    }

    input.runtime.registerDropTarget(
      registration.id,
      registration.element,
      registration.group,
      {
        containerId: registration.containerId,
        sortable: registration.capabilities.sortable,
        sortableAxis:
          input.registry.registration.sortableOptions.get(registration.id)
            ?.axis ?? "vertical",
      },
    );
  }
}

function moveSortablePreviewIntoContainer(input: {
  draggedElement: HTMLElement;
  targetElement: HTMLElement;
}): boolean {
  if (
    input.draggedElement.parentElement === input.targetElement &&
    input.draggedElement.previousSibling === null
  ) {
    return false;
  }

  input.targetElement.insertBefore(
    input.draggedElement,
    input.targetElement.firstChild,
  );
  return true;
}

function getSnapshotRestoreReferenceNode(
  snapshot: SortableSnapshot,
): ChildNode | null {
  if (
    snapshot.nextSibling &&
    snapshot.nextSibling !== snapshot.element &&
    snapshot.nextSibling.parentNode === snapshot.parent
  ) {
    return snapshot.nextSibling;
  }

  if (
    snapshot.previousSibling &&
    snapshot.previousSibling !== snapshot.element &&
    snapshot.previousSibling.parentNode === snapshot.parent
  ) {
    const referenceNode = snapshot.previousSibling.nextSibling;
    return referenceNode === snapshot.element
      ? snapshot.element.nextSibling
      : referenceNode;
  }

  const indexedReferenceNode = snapshot.parent.childNodes.item(
    snapshot.childIndex,
  );

  return indexedReferenceNode === snapshot.element
    ? snapshot.element.nextSibling
    : indexedReferenceNode;
}

export function getAxisPosition(
  pointerPosition: { x: number; y: number },
  axis: SortableAxis,
): number {
  return axis === "horizontal" ? pointerPosition.x : pointerPosition.y;
}

export function getAxisMovementDirection(
  previousAxisPosition: number,
  currentAxisPosition: number,
): SortableAxisMovementDirection {
  if (currentAxisPosition > previousAxisPosition) {
    return "forward";
  }

  if (currentAxisPosition < previousAxisPosition) {
    return "backward";
  }

  return "none";
}

export function getPlacementBoundary(input: {
  targetRect: DOMRect;
  axis: SortableAxis;
  direction: SortableAxisMovementDirection;
  startRatio: number;
  endRatio: number;
}): number {
  const targetStart =
    input.axis === "horizontal" ? input.targetRect.left : input.targetRect.top;
  const targetSize =
    input.axis === "horizontal" ? input.targetRect.width : input.targetRect.height;
  const boundaryRatio =
    input.direction === "forward"
      ? input.startRatio
      : input.direction === "backward"
        ? input.endRatio
        : neutralPlacementBoundaryRatio;

  return targetStart + targetSize * boundaryRatio;
}

export function getPlacementSideFromBoundary(
  axisPosition: number,
  boundary: number,
): SortablePlacementSide {
  return axisPosition < boundary ? "before" : "after";
}
