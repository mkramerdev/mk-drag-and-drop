import type { DragListItem } from "../types";

import { getDragListEntryElement } from "./get-drag-list-entry-element";
import { getEndDropTargetElement } from "./get-end-drop-target-element";
import { getNextItemId } from "./get-next-item-id";
import { rerenderDragItem } from "./rerender-drag-item";

export function renderChangedItemInOrder(input: {
  items: Record<string, DragListItem>;
  itemId: string;
}): void {
  const currentEntry = getDragListEntryElement(input.itemId);
  const parent = currentEntry?.parentElement;

  if (!currentEntry || !parent) {
    return;
  }

  const renderedItem = rerenderDragItem(input.itemId);

  if (!renderedItem) {
    return;
  }

  const nextItemId = getNextItemId(input);
  const nextEntry = nextItemId ? getDragListEntryElement(nextItemId) : null;

  if (nextEntry) {
    nextEntry.before(currentEntry);
    return;
  }

  const endDropTarget = getEndDropTargetElement();

  if (endDropTarget) {
    endDropTarget.before(currentEntry);
    return;
  }

  parent.append(currentEntry);
}
