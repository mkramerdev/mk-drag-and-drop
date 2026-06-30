import type {
  SortableItemKeyGetter,
  SortableItemOrderKeyGetter,
} from "./types.js";

export function findSortableItem<Item>(
  items: readonly Item[],
  itemKey: string,
  getItemKey: SortableItemKeyGetter<Item>,
): Item | null {
  return items.find((item) => getItemKey(item) === itemKey) ?? null;
}

export function getOrderedSortableItems<Item>(
  items: readonly Item[],
  getItemOrderKey: SortableItemOrderKeyGetter<Item>,
): Item[] {
  return [...items].sort((itemA, itemB) =>
    getItemOrderKey(itemA) < getItemOrderKey(itemB) ? -1 : 1,
  );
}
