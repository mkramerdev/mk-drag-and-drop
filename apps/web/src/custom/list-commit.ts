import { getDropTargetElement } from "../dom/targeting/drop-target-elements";
import type { DragListItem } from "./list-data";
import { findDragListItem, getOrderedDragListItems } from "./list-data";
import { getEndDropTargetId } from "./list-drop";
import { getDragListEntryId, renderDragItem } from "./list-render";

export function commitChangedItemInOrder(input: {
  items: readonly DragListItem[];
  itemId: string;
}): void {
  const currentEntry = getDragListEntryElement(input.itemId);
  const parent = currentEntry?.parentElement;

  if (!currentEntry || !parent) {
    return;
  }

  if (!rerenderDragItem(input)) {
    return;
  }

  const nextItemId = getNextItemId(input);
  const nextEntry = nextItemId ? getDragListEntryElement(nextItemId) : null;

  if (nextEntry) {
    nextEntry.before(currentEntry);
    return;
  }

  const endDropTarget = getEndDropTarget();

  if (endDropTarget) {
    endDropTarget.before(currentEntry);
    return;
  }

  parent.append(currentEntry);
}

function getDragListEntryElement(itemId: string): HTMLElement | null {
  return document.getElementById(getDragListEntryId(itemId));
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
  template.innerHTML = renderDragItem(item).trim();

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
  const endDropTargetId = getEndDropTargetId();

  return endDropTargetId ? getDropTargetElement(endDropTargetId) : null;
}
