import type {
  DomSortableRuntime,
  SortableRegistry,
} from "./sortable-registry.js";

type SortablePlacementSide = "before" | "after";

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
}): void {
  if (
    input.activeDropTarget === null ||
    input.activeDropTarget === input.draggedItemId
  ) {
    return;
  }

  const draggedElement = input.registry.elements.get(input.draggedItemId);
  const targetElement = input.registry.elements.get(input.activeDropTarget);
  const listElement = draggedElement?.parentElement ?? targetElement?.parentElement;

  if (
    !draggedElement ||
    !targetElement ||
    !listElement ||
    draggedElement.parentElement !== listElement ||
    targetElement.parentElement !== listElement
  ) {
    return;
  }

  const sortableElements = getSortableItemChildren(listElement);
  const draggedIndex = sortableElements.indexOf(draggedElement);
  const targetIndex = sortableElements.indexOf(targetElement);
  const placement = getSortablePreviewPlacement({
    draggedIndex,
    targetIndex,
  });

  if (
    draggedIndex === -1 ||
    targetIndex === -1 ||
    draggedIndex === targetIndex ||
    placement === null
  ) {
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
}): SortablePlacementSide | null {
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

  if (!snapshot || snapshot.element.parentElement !== snapshot.parent) {
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

  input.runtime.remeasureDropTargets({ group });
}

export function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
  return Array.from(listElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.dndSortableItem !== undefined,
  );
}
