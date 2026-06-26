import { getDropTargetElement } from "../dom/targeting/drop-target-elements";
import type { DragListItem } from "./list-data";
import { findDragListItem, getOrderedDragListItems } from "./list-data";
import {
  getDragListDropTargetKeyBeforeItem,
  getEndDragListDropTargetKey,
} from "./list-drop";
import { renderDragListItem } from "./list-render";

export function commitChangedItemInOrder(input: {
  items: readonly DragListItem[];
  itemId: string;
}): void {
  const currentDropTarget = getDropTargetBeforeItem(input.itemId);
  const currentItem = document.getElementById(input.itemId);
  const parent = currentItem?.parentElement;

  if (!currentDropTarget || !currentItem || !parent) {
    return;
  }

  const nextItem = rerenderDragItem(input);

  if (!nextItem) {
    return;
  }

  const itemNodes = createItemNodeFragment(currentDropTarget, nextItem);
  const nextItemId = getNextItemId(input);
  const nextDropTarget = nextItemId
    ? getDropTargetBeforeItem(nextItemId)
    : null;

  if (nextDropTarget) {
    nextDropTarget.before(itemNodes);
    return;
  }

  const endDropTarget = getEndDropTarget();

  if (endDropTarget) {
    endDropTarget.before(itemNodes);
    return;
  }

  parent.append(itemNodes);
}

function getDropTargetBeforeItem(itemId: string): HTMLElement | null {
  const dropTargetKey = getDragListDropTargetKeyBeforeItem(itemId);

  return dropTargetKey ? getDropTargetElement(dropTargetKey) : null;
}

function createItemNodeFragment(
  dropTargetElement: HTMLElement,
  item: HTMLElement,
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  fragment.append(dropTargetElement, item);

  return fragment;
}

function rerenderDragItem(input: {
  items: readonly DragListItem[];
  itemId: string;
}): HTMLElement | null {
  const item = findDragListItem(input.items, input.itemId);
  const currentElement = document.getElementById(input.itemId);

  if (!item || !currentElement) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = renderDragListItem(item).trim();

  const nextElement = template.content.firstElementChild;

  if (!(nextElement instanceof HTMLElement)) {
    return null;
  }

  currentElement.replaceWith(nextElement);

  return nextElement;
}

function getNextItemId(input: {
  items: readonly DragListItem[];
  itemId: string;
}): string | null {
  const orderedItemIds = getOrderedDragListItems(input.items).map(
    (item) => item.id,
  );
  const itemIndex = orderedItemIds.indexOf(input.itemId);

  if (itemIndex === -1) {
    return null;
  }

  return orderedItemIds[itemIndex + 1] ?? null;
}

function getEndDropTarget(): HTMLElement | null {
  const endDropTargetKey = getEndDragListDropTargetKey();

  return endDropTargetKey ? getDropTargetElement(endDropTargetKey) : null;
}
