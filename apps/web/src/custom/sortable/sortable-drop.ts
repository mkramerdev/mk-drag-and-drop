import { generateKeyBetween } from "../shared/fractional-indexing";
import {
  dragListItems,
  findDragListItem,
  type DragListItem,
} from "../shared/list-data";
import { getSortableItemElement } from "./sortable-render";

export function applySortableDrop(input: {
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

  const previousOrderKey = getSortableSiblingOrderKey(
    draggedElement.previousElementSibling,
  );
  const nextOrderKey = getSortableSiblingOrderKey(
    draggedElement.nextElementSibling,
  );

  draggedItem.orderKey = generateKeyBetween(previousOrderKey, nextOrderKey);
  draggedElement.dataset.orderKey = draggedItem.orderKey;
}

function getSortableSiblingOrderKey(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  return element.dataset.orderKey ?? null;
}
