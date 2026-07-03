import type {
  DomSortableRuntime,
  SortableRegistry,
  SortableSnapshot,
} from "./sortable-registry.js";

type SortablePlacementSide = "before" | "after";

const pendingRemeasureFrames = new WeakMap<
  DomSortableRuntime,
  Map<string, number>
>();

export function snapshotSortableElement(
  registry: SortableRegistry,
  itemId: string,
): void {
  const element = registry.elements.get(itemId);

  if (!element?.parentElement) {
    return;
  }

  element.dataset.dndDragged = "true";
  registry.snapshots.set(itemId, {
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
  draggedItemId: string;
  activeDropTarget: string | null;
}): boolean {
  return (
    input.activeDropTarget !== null &&
    input.activeDropTarget !== input.draggedItemId
  );
}

export function moveSortablePreview(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  draggedItemId: string;
  activeDropTarget: string | null;
  pointerPosition: { x: number; y: number };
}): void {
  if (
    input.activeDropTarget === null ||
    input.activeDropTarget === input.draggedItemId
  ) {
    return;
  }

  const draggedElement = input.registry.elements.get(input.draggedItemId);
  const draggedGroup = input.registry.groups.get(input.draggedItemId);

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

  if (target.kind === "container") {
    moveSortablePreviewIntoContainer({
      draggedElement,
      targetElement: target.element,
    });

    remeasureSortableDropTargetGroup({
      registry: input.registry,
      runtime: input.runtime,
      itemId: input.draggedItemId,
    });
    return;
  }

  const targetElement = target.element;
  const listElement = targetElement.parentElement;

  if (!listElement) {
    return;
  }

  const sortableElements = getSortableItemChildren(listElement);
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
    pointerPosition: input.pointerPosition,
  });

  if (isBlockedBySkippedSibling) {
    return;
  }

  const placement = getSortablePreviewPlacement({
    draggedIndex,
    targetIndex,
    targetElement,
    pointerPosition: input.pointerPosition,
  });

  if (targetIndex === -1 || placement === null) {
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
    itemId: input.draggedItemId,
  });
}

export function getSortablePreviewPlacement(input: {
  draggedIndex: number;
  targetIndex: number;
  targetElement: HTMLElement;
  pointerPosition: { x: number; y: number };
}): SortablePlacementSide | null {
  if (input.draggedIndex === -1) {
    return getPointerPlacementSide({
      targetElement: input.targetElement,
      pointerPosition: input.pointerPosition,
    });
  }

  if (input.targetIndex > input.draggedIndex) {
    return "after";
  }

  if (input.targetIndex < input.draggedIndex) {
    return "before";
  }

  return null;
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
  itemId: string,
): boolean {
  const snapshot = registry.snapshots.get(itemId);

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
  itemId: string,
): void {
  const element =
    registry.elements.get(itemId) ?? registry.snapshots.get(itemId)?.element;

  if (element) {
    delete element.dataset.dndDragged;
  }
}

export function remeasureSortableDropTargetGroup(input: {
  registry: SortableRegistry;
  runtime: DomSortableRuntime;
  itemId: string;
}): void {
  const group = input.registry.groups.get(input.itemId);

  if (!group) {
    return;
  }

  scheduleSortableDropTargetGroupRemeasure(input.runtime, group);
}

export function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
  return Array.from(listElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.dndSortableItem !== undefined,
  );
}

function isPreviewBlockedBySkippedSortableSibling(input: {
  registry: SortableRegistry;
  draggedGroup: string;
  sortableElements: HTMLElement[];
  draggedIndex: number;
  targetIndex: number;
  targetElement: HTMLElement;
  pointerPosition: { x: number; y: number };
}): boolean {
  if (input.draggedIndex === -1 || input.targetIndex === -1) {
    return false;
  }

  const startIndex = Math.min(input.draggedIndex, input.targetIndex) + 1;
  const endIndex = Math.max(input.draggedIndex, input.targetIndex);
  const targetDistance = getPointToRectCenterDistance(
    input.pointerPosition,
    input.targetElement.getBoundingClientRect(),
  );

  for (let index = startIndex; index < endIndex; index += 1) {
    const sibling = input.sortableElements[index];
    const siblingItemId = getSortableItemId(input.registry, sibling);

    if (!siblingItemId) {
      continue;
    }

    const siblingGroup = input.registry.groups.get(siblingItemId);

    if (siblingGroup === input.draggedGroup) {
      continue;
    }

    const siblingDistance = getPointToRectCenterDistance(
      input.pointerPosition,
      sibling.getBoundingClientRect(),
    );

    if (siblingDistance <= targetDistance) {
      return true;
    }
  }

  return false;
}

function getSortableItemId(
  registry: SortableRegistry,
  element: HTMLElement,
): string | null {
  for (const [itemId, sortableElement] of registry.elements) {
    if (sortableElement === element) {
      return itemId;
    }
  }

  return null;
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

function getPointerPlacementSide(input: {
  targetElement: HTMLElement;
  pointerPosition: { x: number; y: number };
}): SortablePlacementSide {
  const rect = input.targetElement.getBoundingClientRect();
  const axis = getSortableLayoutAxis(input.targetElement);

  if (axis === "horizontal") {
    return input.pointerPosition.x >= rect.left + rect.width / 2
      ? "after"
      : "before";
  }

  return input.pointerPosition.y >= rect.top + rect.height / 2
    ? "after"
    : "before";
}

function getSortableLayoutAxis(
  targetElement: HTMLElement,
): "horizontal" | "vertical" {
  const parent = targetElement.parentElement;

  if (!parent) {
    return "vertical";
  }

  const childRects = getSortableItemChildren(parent).map((child) =>
    child.getBoundingClientRect(),
  );

  if (childRects.length >= 2) {
    const horizontalSpread = getCenterSpread(childRects, "x");
    const verticalSpread = getCenterSpread(childRects, "y");

    return horizontalSpread > verticalSpread ? "horizontal" : "vertical";
  }

  const targetRect = targetElement.getBoundingClientRect();

  return targetRect.height > targetRect.width ? "horizontal" : "vertical";
}

function getCenterSpread(
  rects: DOMRect[],
  axis: "x" | "y",
): number {
  const centers = rects.map((rect) =>
    axis === "x"
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2,
  );

  return Math.max(...centers) - Math.min(...centers);
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
