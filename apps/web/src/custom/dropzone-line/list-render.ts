import type { DragListItem } from "../shared/list-data";

export function getDragListHandleElementId(itemId: string): string {
  return `${itemId}-drag-handle`;
}

export function getDragListDropTargetKey(index: number): string {
  return `demo-drag-list-drop-target-${index}`;
}

export function createDragListDropTargetElement(options: {
  dropTargetKey: string;
}): HTMLElement {
  const dropTargetElement = document.createElement("div");
  dropTargetElement.id = options.dropTargetKey;
  dropTargetElement.className = "dragListDropTarget";
  dropTargetElement.dataset.dndDropTargetKey = options.dropTargetKey;

  const dropIndicator = document.createElement("div");
  dropIndicator.className = "dragListDropIndicator";
  dropIndicator.setAttribute("aria-hidden", "true");

  dropTargetElement.append(dropIndicator);

  return dropTargetElement;
}

export function createDragListItemElement(item: DragListItem): HTMLElement {
  const dragListHandleElementId = getDragListHandleElementId(item.id);
  const itemElement = document.createElement("div");
  itemElement.id = item.id;
  itemElement.className = "dragListItem";
  itemElement.dataset.dndItemId = item.id;
  itemElement.dataset.orderKey = item.orderKey;

  const dragHandle = document.createElement("div");
  dragHandle.id = dragListHandleElementId;
  dragHandle.className = "dragListHandle";
  dragHandle.dataset.dndDragKey = item.id;

  const content = document.createElement("div");
  content.className = "dragListItemText";
  content.textContent = item.content;

  itemElement.append(dragHandle, content);

  return itemElement;
}
