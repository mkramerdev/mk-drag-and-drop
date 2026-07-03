import type {
  DomSortableRuntime,
  SortableRegistry,
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
    nextSibling: element.nextSibling,
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

  if (snapshot.nextSibling?.parentNode === snapshot.parent) {
    snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
    return true;
  }

  snapshot.parent.append(snapshot.element);
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

function moveSortablePreviewIntoContainer(input: {
  draggedElement: HTMLElement;
  targetElement: HTMLElement;
}): void {
  if (
    input.draggedElement.parentElement === input.targetElement &&
    input.draggedElement.nextElementSibling === null
  ) {
    return;
  }

  input.targetElement.append(input.draggedElement);
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
