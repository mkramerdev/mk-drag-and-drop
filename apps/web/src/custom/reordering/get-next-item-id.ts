import type { DragListItem } from "../types";

export function getNextItemId(input: {
  items: Record<string, DragListItem>;
  itemId: string;
}): string | null {
  const orderedItemIds = Object.keys(input.items).sort((itemIdA, itemIdB) =>
    input.items[itemIdA]!.orderKey < input.items[itemIdB]!.orderKey ? -1 : 1,
  );
  const itemIndex = orderedItemIds.indexOf(input.itemId);

  if (itemIndex === -1) {
    return null;
  }

  return orderedItemIds[itemIndex + 1] ?? null;
}
