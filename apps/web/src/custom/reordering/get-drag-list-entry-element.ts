import { getDragListEntryId } from "../get-drag-list-entry-id";

export function getDragListEntryElement(itemId: string): HTMLElement | null {
  return document.getElementById(getDragListEntryId(itemId));
}
