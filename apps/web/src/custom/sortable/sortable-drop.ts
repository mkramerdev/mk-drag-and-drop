import { generateKeyBetween } from "../shared/fractional-indexing";
import {
  dragListItems,
  findDragListItem,
  type DragListItem,
} from "../shared/list-data";
import {
  isSortablePreviewInOriginalOrder,
  restoreSortablePreview,
  type SortablePreviewSession,
} from "./sortable-preview";

export function applySortableDrop(input: {
  session: SortablePreviewSession;
  draggedKey: string;
  items?: readonly DragListItem[];
}): void {
  if (isSortablePreviewInOriginalOrder(input.session)) {
    restoreSortablePreview(input.session);
    return;
  }

  const items = input.items ?? dragListItems;
  const draggedItem = findDragListItem(items, input.draggedKey);
  const draggedElement = input.session.draggedElement;
  const previousOrderKey = getSortableSiblingOrderKey(
    draggedElement.previousElementSibling,
  );
  const nextOrderKey = getSortableSiblingOrderKey(
    draggedElement.nextElementSibling,
  );

  if (!draggedItem) {
    restoreSortablePreview(input.session);
    return;
  }

  draggedItem.orderKey = generateKeyBetween(previousOrderKey, nextOrderKey);
  draggedElement.dataset.orderKey = draggedItem.orderKey;
}

function getSortableSiblingOrderKey(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  return element.dataset.orderKey ?? null;
}
