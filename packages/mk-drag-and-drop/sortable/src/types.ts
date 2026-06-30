export type SortableItemElementGetter = (
  itemKey: string,
) => HTMLElement | null;

export type SortableItemKeyGetter<Item> = (item: Item) => string;

export type SortableItemOrderKeyGetter<Item> = (item: Item) => string;

export type SortableItemOrderKeySetter<Item> = (
  item: Item,
  orderKey: string,
) => void;
