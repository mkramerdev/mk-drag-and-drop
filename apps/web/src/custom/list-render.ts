import type { DragOverlayRenderer } from "../dom/types";
import type { DragListItem, DragListItemPayload } from "./list-data";

export function getDragHandleId(itemId: string): string {
  return `${itemId}-drag-handle`;
}

export function getDragListEntryId(itemId: string): string {
  return `${itemId}-list-entry`;
}

export function getDropTargetId(index: number): string {
  return `demo-drag-list-drop-target-${index}`;
}

export function renderDropTarget(options: { dropTargetId: string }): string {
  return `
    <div
      id="${options.dropTargetId}"
      class="dropTarget"
      data-dnd-drop-target-id="${options.dropTargetId}"
    >
      <div class="dropTargetLine" aria-hidden="true"></div>
    </div>
  `;
}

export function renderDragItem(item: DragListItem): string {
  const dragHandleId = getDragHandleId(item.id);

  return `
    <div
      id="${item.id}"
      class="dragItem"
      data-dnd-item-id="${item.id}"
      data-order-key="${item.orderKey}"
    >
      <div
        id="${dragHandleId}"
        class="dragHandle"
        data-dnd-drag-handle-id="${dragHandleId}"
        data-dnd-drag-handle-for="${item.id}"
      ></div>
      <div class="dragItemText">${item.content}</div>
    </div>
  `;
}

export function renderDragListEntry(options: {
  entryId: string;
  dropTargetId: string;
  item: DragListItem;
}): string {
  return `
    <div
      id="${options.entryId}"
      class="dragListEntry"
      data-dnd-list-entry-for="${options.item.id}"
    >
      ${renderDropTarget({ dropTargetId: options.dropTargetId })}
      ${renderDragItem(options.item)}
    </div>
  `;
}

export const renderCustomOverlay: DragOverlayRenderer<DragListItemPayload> = (
  payload: DragListItemPayload,
) => {
  const element = document.createElement("div");
  element.className = "dragItem1";

  const dragHandle = document.createElement("div");
  dragHandle.className = "dragHandle";

  const content = document.createElement("div");
  content.className = "dragItemText";
  content.textContent = payload.content;

  element.append(dragHandle, content);

  return element;
};
