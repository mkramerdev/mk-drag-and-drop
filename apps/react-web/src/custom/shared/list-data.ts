export type DragListItem = {
  id: string;
  orderKey: string;
  content: string;
};

const initialDragListItems: readonly DragListItem[] = [
  {
    id: "drag-item-1",
    orderKey: "a0",
    content: "Item 1",
  },
  {
    id: "drag-item-2",
    orderKey: "a1",
    content: "Item 2",
  },
  {
    id: "drag-item-3",
    orderKey: "a2",
    content: "Item 3",
  },
  {
    id: "drag-item-4",
    orderKey: "a3",
    content: "Item 4",
  },
  {
    id: "drag-item-5",
    orderKey: "a4",
    content: "Item 5",
  },
];

export const dragListItems: DragListItem[] = createDragListItems();

export function createDragListItems(): DragListItem[] {
  return initialDragListItems.map((item) => ({ ...item }));
}

export function findDragListItem(
  items: readonly DragListItem[],
  itemId: string,
): DragListItem | null {
  return items.find((item) => item.id === itemId) ?? null;
}

export function getOrderedDragListItems(
  items: readonly DragListItem[] = dragListItems,
): DragListItem[] {
  return [...items].sort((itemA, itemB) =>
    itemA.orderKey < itemB.orderKey ? -1 : 1,
  );
}
