import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
  type DragListItem,
} from "../shared/list-data";
import { getSortableItemElement } from "./sortable-render";

export function moveSortablePreview(input: {
  draggedKey: string;
  activeDropTargetKey: string | null;
  listElement?: HTMLElement;
}): void {
  if (
    input.activeDropTargetKey === null ||
    input.activeDropTargetKey === input.draggedKey
  ) {
    return;
  }

  const draggedElement = getSortableItemElement(input.draggedKey);
  const targetElement = getSortableItemElement(input.activeDropTargetKey);
  const listElement =
    input.listElement ??
    draggedElement?.parentElement ??
    targetElement?.parentElement;

  if (
    !draggedElement ||
    !targetElement ||
    !listElement ||
    draggedElement.parentElement !== listElement ||
    targetElement.parentElement !== listElement
  ) {
    return;
  }

  const sortableItems = getSortableItemChildren(listElement);
  const draggedIndex = sortableItems.indexOf(draggedElement);
  const targetIndex = sortableItems.indexOf(targetElement);

  if (
    draggedIndex === -1 ||
    targetIndex === -1 ||
    draggedIndex === targetIndex
  ) {
    return;
  }

  if (draggedIndex < targetIndex) {
    targetElement.after(draggedElement);
    return;
  }

  targetElement.before(draggedElement);
}

export function restoreSortableDraggedItem(input: {
  listElement: HTMLElement;
  draggedKey: string;
  items?: readonly DragListItem[];
}): void {
  const items = input.items ?? dragListItems;
  const draggedItem = findDragListItem(items, input.draggedKey);
  const draggedElement = getSortableItemElement(input.draggedKey);

  if (
    !draggedItem ||
    !draggedElement ||
    draggedElement.parentElement !== input.listElement
  ) {
    return;
  }

  const orderedItems = getOrderedDragListItems(items);
  const draggedIndex = orderedItems.findIndex(
    (item) => item.id === draggedItem.id,
  );

  if (draggedIndex === -1) {
    return;
  }

  const nextElement = findNextCanonicalSortableElement({
    draggedKey: input.draggedKey,
    draggedIndex,
    listElement: input.listElement,
    orderedItems,
  });

  if (nextElement) {
    input.listElement.insertBefore(draggedElement, nextElement);
    return;
  }

  input.listElement.append(draggedElement);
}

function findNextCanonicalSortableElement(input: {
  draggedKey: string;
  draggedIndex: number;
  listElement: HTMLElement;
  orderedItems: readonly DragListItem[];
}): HTMLElement | null {
  for (
    let index = input.draggedIndex + 1;
    index < input.orderedItems.length;
    index += 1
  ) {
    const item = input.orderedItems[index];

    if (!item || item.id === input.draggedKey) {
      continue;
    }

    const itemElement = getSortableItemElement(item.id);

    if (itemElement?.parentElement === input.listElement) {
      return itemElement;
    }
  }

  return null;
}

function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
  return Array.from(listElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.dndDropTargetKey !== undefined,
  );
}
