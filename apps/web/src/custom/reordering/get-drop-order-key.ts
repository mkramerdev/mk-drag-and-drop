import { generateKeyBetween } from "./fractional-indexing";
import { getOrderedDragListEntries } from "./get-ordered-drag-list-entries";

export function getDropOrderKey(options: {
  draggedKey: string;
  beforeItemId: string | null;
}): string | null {
  const orderedEntries = getOrderedDragListEntries().filter(
    ([itemId]) => itemId !== options.draggedKey,
  );

  if (options.beforeItemId === options.draggedKey) {
    return null;
  }

  if (options.beforeItemId === null) {
    const previousEntry = orderedEntries[orderedEntries.length - 1];

    return generateKeyBetween(previousEntry?.[1].orderKey, null);
  }

  const nextIndex = orderedEntries.findIndex(
    ([itemId]) => itemId === options.beforeItemId,
  );

  if (nextIndex === -1) {
    return null;
  }

  const previousOrderKey =
    nextIndex > 0 ? orderedEntries[nextIndex - 1]![1].orderKey : null;
  const nextOrderKey = orderedEntries[nextIndex]![1].orderKey;

  return generateKeyBetween(previousOrderKey, nextOrderKey);
}
