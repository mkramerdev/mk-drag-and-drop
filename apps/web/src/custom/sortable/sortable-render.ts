import type { DragListItem } from "../shared/list-data";

export function createSortableItemElement(item: DragListItem): HTMLElement {
  const element = document.createElement("div");

  element.id = getSortableElementId(item.id);
  element.className = "dragListItem";
  element.dataset.dndDragKey = item.id;
  element.dataset.dndDropTargetKey = item.id;
  element.dataset.dndItemId = item.id;
  element.dataset.orderKey = item.orderKey;

  const dragHandle = document.createElement("div");
  dragHandle.id = `${getSortableElementId(item.id)}-drag-handle`;
  dragHandle.className = "dragListHandle";
  dragHandle.dataset.dndDragKey = item.id;

  const text = document.createElement("div");
  text.className = "dragListItemText";
  text.textContent = item.content;

  element.append(dragHandle, text);

  return element;
}

export function getSortableElementId(itemId: string): string {
  return `sortable-${itemId}`;
}

export function getSortableItemElement(itemId: string): HTMLElement | null {
  return document.getElementById(getSortableElementId(itemId));
}
