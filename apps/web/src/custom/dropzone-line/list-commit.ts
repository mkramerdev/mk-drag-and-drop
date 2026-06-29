import type { DragListItem } from "../shared/list-data";
import {
  findDragListItem,
  getOrderedDragListItems,
} from "../shared/list-data";
import type { DragListDropTargetRegistry } from "./list-drop";
import { createDragListItemElement } from "./list-render";

export function commitChangedItemInOrder(input: {
  items: readonly DragListItem[];
  dropTargets: DragListDropTargetRegistry;
  itemId: string;
}): void {
  const currentDropTarget = getDropTargetBeforeItem(
    input.dropTargets,
    input.itemId,
  );
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
    ? getDropTargetBeforeItem(input.dropTargets, nextItemId)
    : null;

  if (nextDropTarget) {
    nextDropTarget.before(itemNodes);
    return;
  }

  const endDropTarget = getEndDropTarget(input.dropTargets);

  if (endDropTarget) {
    endDropTarget.before(itemNodes);
    return;
  }

  parent.append(itemNodes);
}

function getDropTargetBeforeItem(
  dropTargets: DragListDropTargetRegistry,
  itemId: string,
): HTMLElement | null {
  const dropTargetKey = dropTargets.getDropTargetKeyBeforeItem(itemId);

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

  const nextElement = createDragListItemElement(item);
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

function getEndDropTarget(
  dropTargets: DragListDropTargetRegistry,
): HTMLElement | null {
  const endDropTargetKey = dropTargets.getEndDropTargetKey();

  return endDropTargetKey ? getDropTargetElement(endDropTargetKey) : null;
}

function getDropTargetElement(dropTargetKey: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-dnd-drop-target-key="${CSS.escape(dropTargetKey)}"]`,
  );
}
