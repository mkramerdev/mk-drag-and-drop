import { dragListItems } from "../mock-data";
import type { DragListItem } from "../types";

export function getOrderedDragListEntries(): Array<[string, DragListItem]> {
  return Object.entries(dragListItems).sort(
    ([, itemA], [, itemB]) => (itemA.orderKey < itemB.orderKey ? -1 : 1),
  );
}
