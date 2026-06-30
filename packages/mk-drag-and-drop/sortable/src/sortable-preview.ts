import { findSortableItem, getOrderedSortableItems } from "./items.js";
import type {
  SortableItemElementGetter,
  SortableItemKeyGetter,
  SortableItemOrderKeyGetter,
} from "./types.js";

export function shouldMoveSortablePreview(input: {
  draggedKey: string;
  activeDropTargetKey: string | null;
  previousDropTargetKey: string | null;
}): boolean {
  return (
    input.activeDropTargetKey !== null &&
    input.activeDropTargetKey !== input.previousDropTargetKey &&
    input.activeDropTargetKey !== input.draggedKey
  );
}

export function moveSortablePreview(input: {
  draggedKey: string;
  activeDropTargetKey: string | null;
  getItemElement: SortableItemElementGetter;
  listElement?: HTMLElement;
}): void {
  if (
    input.activeDropTargetKey === null ||
    input.activeDropTargetKey === input.draggedKey
  ) {
    return;
  }

  const draggedElement = input.getItemElement(input.draggedKey);
  const targetElement = input.getItemElement(input.activeDropTargetKey);
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

export function restoreSortableDraggedItem<Item>(input: {
  draggedKey: string;
  items: readonly Item[];
  getItemKey: SortableItemKeyGetter<Item>;
  getItemOrderKey: SortableItemOrderKeyGetter<Item>;
  getItemElement: SortableItemElementGetter;
  listElement?: HTMLElement;
}): void {
  const draggedItem = findSortableItem(
    input.items,
    input.draggedKey,
    input.getItemKey,
  );
  const draggedElement = input.getItemElement(input.draggedKey);
  const listElement = input.listElement ?? draggedElement?.parentElement;

  if (
    !draggedItem ||
    !draggedElement ||
    !listElement ||
    draggedElement.parentElement !== listElement
  ) {
    return;
  }

  const orderedItems = getOrderedSortableItems(
    input.items,
    input.getItemOrderKey,
  );
  const draggedIndex = orderedItems.findIndex(
    (item) => input.getItemKey(item) === input.draggedKey,
  );

  if (draggedIndex === -1) {
    return;
  }

  const nextElement = findNextCanonicalSortableElement({
    draggedKey: input.draggedKey,
    draggedIndex,
    listElement,
    orderedItems,
    getItemKey: input.getItemKey,
    getItemElement: input.getItemElement,
  });

  if (nextElement) {
    listElement.insertBefore(draggedElement, nextElement);
    return;
  }

  listElement.append(draggedElement);
}

function findNextCanonicalSortableElement<Item>(input: {
  draggedKey: string;
  draggedIndex: number;
  listElement: HTMLElement;
  orderedItems: readonly Item[];
  getItemKey: SortableItemKeyGetter<Item>;
  getItemElement: SortableItemElementGetter;
}): HTMLElement | null {
  for (
    let index = input.draggedIndex + 1;
    index < input.orderedItems.length;
    index += 1
  ) {
    const item = input.orderedItems[index];

    if (!item || input.getItemKey(item) === input.draggedKey) {
      continue;
    }

    const itemElement = input.getItemElement(input.getItemKey(item));

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
