import { generateKeyBetween } from "./fractional-indexing.js";
import { findSortableItem } from "./items.js";
import type {
  SortableItemElementGetter,
  SortableItemKeyGetter,
  SortableItemOrderKeyGetter,
  SortableItemOrderKeySetter,
} from "./types.js";

export function applySortableDrop<Item>(input: {
  draggedKey: string;
  items: readonly Item[];
  getItemKey: SortableItemKeyGetter<Item>;
  getItemOrderKey: SortableItemOrderKeyGetter<Item>;
  setItemOrderKey: SortableItemOrderKeySetter<Item>;
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

  const previousOrderKey = getSortableSiblingOrderKey(
    draggedElement.previousElementSibling,
    input,
  );
  const nextOrderKey = getSortableSiblingOrderKey(
    draggedElement.nextElementSibling,
    input,
  );
  const orderKey = generateKeyBetween(previousOrderKey, nextOrderKey);

  input.setItemOrderKey(draggedItem, orderKey);
}

function getSortableSiblingOrderKey<Item>(
  element: Element | null,
  input: {
    items: readonly Item[];
    getItemKey: SortableItemKeyGetter<Item>;
    getItemOrderKey: SortableItemOrderKeyGetter<Item>;
    getItemElement: SortableItemElementGetter;
  },
): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  for (const item of input.items) {
    const itemKey = input.getItemKey(item);

    if (input.getItemElement(itemKey) === element) {
      return input.getItemOrderKey(item);
    }
  }

  return null;
}
