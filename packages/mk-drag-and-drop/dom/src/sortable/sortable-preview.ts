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
  lastNonNoneDirectionByAxis: Record<
    SortableAxis,
    Exclude<SortableAxisMovementDirection, "none"> | null
  >;
};

const neutralPlacementBoundaryRatio = 0.5;

const pendingRemeasureFrames = new WeakMap<
  DomSortableRuntime,
  Map<string, number>
>();

export function snapshotSortableElement(
  registry: SortableRegistry,
  draggableId: string,
): void {
  const element = getRegisteredSortableElement(registry, draggableId);

  if (!element?.parentElement) {
    return;
  }

  element.dataset.dndDragged = "true";
  registry.snapshots.set(draggableId, {
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
  draggedDraggableId: string;
  activeDropTarget: string | null;
}): boolean {
  return (
    input.activeDropTarget !== null &&
    input.activeDropTarget !== input.draggedDraggableId
  );
}

export function initializeSortablePointerMovement(
  registry: SortableRegistry,
  pointerPosition: { x: number; y: number },
): void {
  registry.pointerMovement = {
    previousPointerPosition: { ...pointerPosition },
    lastNonNoneDirectionByAxis: {
      horizontal: null,
      vertical: null,
    },
  };
}

export function updateSortablePointerMovement(
  registry: SortableRegistry,
  pointerPosition: { x: number; y: number },
): void {
  const movement = registry.pointerMovement;

  if (!movement) {
    initializeSortablePointerMovement(registry, pointerPosition);
    return;
  }

  updateLastNonNoneDirectionForAxis({
    movement,
    axis: "horizontal",
    currentAxisPosition: pointerPosition.x,
  });
  updateLastNonNoneDirectionForAxis({
    movement,
    axis: "vertical",
    currentAxisPosition: pointerPosition.y,
  });

  movement.previousPointerPosition = { ...pointerPosition };
}

export function clearSortablePointerMovement(registry: SortableRegistry): void {
  registry.pointerMovement = null;
}

export function moveSortablePreview(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggedDraggableId: string;
  activeDropTarget: string | null;
  pointerPosition: { x: number; y: number };
  placementPosition: { x: number; y: number };
  options: NormalizedSortableOptions;
}): void {
  if (
    input.activeDropTarget === null ||
    input.activeDropTarget === input.draggedDraggableId
  ) {
    return;
  }

  const draggedElement = getRegisteredSortableElement(
    input.registry,
    input.draggedDraggableId,
  );
  const draggedGroup = input.registry.groups.get(input.draggedDraggableId);

  if (!draggedElement || !draggedGroup) {
    return;
  }

  const target = input.runtime.getDropTargetRegistration(
    input.activeDropTarget,
    draggedGroup,
  );

  if (!target) {
    return;
  }

  if (target.capabilities.container) {
    moveSortablePreviewIntoContainer({
      draggedElement,
      targetElement: target.element,
    });

    remeasureSortableDropTargetGroup({
      registry: input.registry,
      runtime: input.runtime,
      draggableId: input.draggedDraggableId,
    });
    return;
  }

  const targetElement = target.element;
  const listElement = targetElement.parentElement;

  if (!listElement) {
    return;
  }

  const sortableElements = getSortableDraggableChildren(listElement);
  const draggedIndex =
    draggedElement.parentElement === listElement
      ? sortableElements.indexOf(draggedElement)
      : -1;
  const targetIndex = sortableElements.indexOf(targetElement);
  const isBlockedBySkippedSibling = isPreviewBlockedBySkippedSortableSibling({
    registry: input.registry,
    draggedGroup,
    sortableElements,
    draggedIndex,
    targetIndex,
    targetElement,
    placementPosition: input.placementPosition,
  });

  if (isBlockedBySkippedSibling) {
    return;
  }

  const placement = getSortablePreviewPlacement({
    targetElement,
    pointerPosition: input.pointerPosition,
    placementPosition: input.placementPosition,
    movement: input.registry.pointerMovement,
    options: input.options,
  });

  if (targetIndex === -1) {
    return;
  }

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

  remeasureSortableDropTargetGroup({
    registry: input.registry,
    runtime: input.runtime,
    draggableId: input.draggedDraggableId,
  });
}

export function getSortablePreviewPlacement(input: {
  targetElement: HTMLElement;
  pointerPosition: { x: number; y: number };
  placementPosition: { x: number; y: number };
  movement: SortablePointerMovementState | null;
  options: NormalizedSortableOptions;
}): SortablePlacementSide {
  const axis = input.options.axis;
  const axisPosition = getAxisPosition(input.placementPosition, axis);
  const pointerAxisPosition = getAxisPosition(input.pointerPosition, axis);
  const previousAxisPosition = input.movement
    ? getAxisPosition(input.movement.previousPointerPosition, axis)
    : pointerAxisPosition;
  const currentDirection = getAxisMovementDirection(
    previousAxisPosition,
    pointerAxisPosition,
  );
  const direction =
    currentDirection === "none"
      ? (input.movement?.lastNonNoneDirectionByAxis[axis] ?? "none")
      : currentDirection;
  const boundary = getPlacementBoundary({
    targetRect: input.targetElement.getBoundingClientRect(),
    axis,
    direction,
    startRatio: input.options.placementBoundary.start,
    endRatio: input.options.placementBoundary.end,
  });

  return getPlacementSideFromBoundary(axisPosition, boundary);
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
  const snapshot = registry.snapshots.get(draggableId);

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
    registry.snapshots.get(draggableId)?.element;

  if (element) {
    restoreSortableDraggedAttribute({
      registry,
      draggableId,
      element,
    });
  }
}

export function remeasureSortableDropTargetGroup(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggableId: string;
}): void {
  const group = input.registry.groups.get(input.draggableId);

  if (!group) {
    return;
  }

  scheduleSortableDropTargetGroupRemeasure(input.runtime, group);
}

export function getSortableDraggableChildren(listElement: HTMLElement): HTMLElement[] {
  const sortableChildren: HTMLElement[] = [];

  for (let index = 0; index < listElement.children.length; index += 1) {
    const child = listElement.children.item(index);

    if (
      child instanceof HTMLElement &&
      child.dataset.dndSortableDraggable !== undefined
    ) {
      sortableChildren.push(child);
    }
  }

  return sortableChildren;
}

function isPreviewBlockedBySkippedSortableSibling(input: {
  registry: SortableRegistry;
  draggedGroup: string;
  sortableElements: HTMLElement[];
  draggedIndex: number;
  targetIndex: number;
  targetElement: HTMLElement;
  placementPosition: { x: number; y: number };
}): boolean {
  if (input.draggedIndex === -1 || input.targetIndex === -1) {
    return false;
  }

  const startIndex = Math.min(input.draggedIndex, input.targetIndex) + 1;
  const endIndex = Math.max(input.draggedIndex, input.targetIndex);
  let targetDistance: number | null = null;

  for (let index = startIndex; index < endIndex; index += 1) {
    const sibling = input.sortableElements[index];
    const siblingDraggableId = getSortableDraggableId(input.registry, sibling);

    if (!siblingDraggableId) {
      continue;
    }

    const siblingGroup = input.registry.groups.get(siblingDraggableId);

    if (siblingGroup === input.draggedGroup) {
      continue;
    }

    if (targetDistance === null) {
      targetDistance = getPointToRectCenterDistance(
        input.placementPosition,
        input.targetElement.getBoundingClientRect(),
      );
    }

    const siblingDistance = getPointToRectCenterDistance(
      input.placementPosition,
      sibling.getBoundingClientRect(),
    );

    if (siblingDistance <= targetDistance) {
      return true;
    }
  }

  return false;
}

function getSortableDraggableId(
  registry: SortableRegistry,
  element: HTMLElement,
): string | null {
  const draggableId = registry.elementIds.get(element);

  return draggableId && registry.elements.get(draggableId)?.deref() === element
    ? draggableId
    : null;
}

function getPointToRectCenterDistance(
  point: { x: number; y: number },
  rect: DOMRect,
): number {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const distanceX = point.x - centerX;
  const distanceY = point.y - centerY;

  return distanceX * distanceX + distanceY * distanceY;
}

function moveSortablePreviewIntoContainer(input: {
  draggedElement: HTMLElement;
  targetElement: HTMLElement;
}): void {
  if (
    input.draggedElement.parentElement === input.targetElement &&
    input.draggedElement.previousSibling === null
  ) {
    return;
  }

  input.targetElement.insertBefore(
    input.draggedElement,
    input.targetElement.firstChild,
  );
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

function updateLastNonNoneDirectionForAxis(input: {
  movement: SortablePointerMovementState;
  axis: SortableAxis;
  currentAxisPosition: number;
}): void {
  const previousAxisPosition = getAxisPosition(
    input.movement.previousPointerPosition,
    input.axis,
  );
  const direction = getAxisMovementDirection(
    previousAxisPosition,
    input.currentAxisPosition,
  );

  if (direction !== "none") {
    input.movement.lastNonNoneDirectionByAxis[input.axis] = direction;
  }
}

export function cancelSortableDropTargetGroupRemeasure(
  runtime: DomSortableRuntime,
): void {
  const pendingFrames = pendingRemeasureFrames.get(runtime);

  if (!pendingFrames) {
    return;
  }

  for (const frameId of pendingFrames.values()) {
    window.cancelAnimationFrame(frameId);
  }

  pendingRemeasureFrames.delete(runtime);
}

function scheduleSortableDropTargetGroupRemeasure(
  runtime: DomSortableRuntime,
  group: string,
): void {
  let pendingFrames = pendingRemeasureFrames.get(runtime);

  if (!pendingFrames) {
    pendingFrames = new Map();
    pendingRemeasureFrames.set(runtime, pendingFrames);
  }

  if (pendingFrames.has(group)) {
    return;
  }

  const frameId = window.requestAnimationFrame(() => {
    pendingFrames?.delete(group);

    if (pendingFrames?.size === 0) {
      pendingRemeasureFrames.delete(runtime);
    }

    runtime.remeasureDropTargets({ group });
  });

  pendingFrames.set(group, frameId);
}
