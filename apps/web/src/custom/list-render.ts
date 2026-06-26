import type { DragOverlayContentRenderer } from "../dom/types";
import type { DragListItem, DragListItemPayload } from "./list-data";

export function getDragListHandleElementId(itemId: string): string {
  return `${itemId}-drag-handle`;
}

export function getDragListDropTargetKey(index: number): string {
  return `demo-drag-list-drop-target-${index}`;
}

export function renderDragListDropTarget(options: {
  dropTargetKey: string;
}): string {
  const dropTargetElementId = options.dropTargetKey;

  return `
    <div
      id="${dropTargetElementId}"
      class="dragListDropTarget"
      data-dnd-drop-target-key="${options.dropTargetKey}"
    >
      <div class="dragListDropIndicator" aria-hidden="true"></div>
    </div>
  `;
}

export function renderDragListItem(item: DragListItem): string {
  const dragListHandleElementId = getDragListHandleElementId(item.id);

  return `
    <div
      id="${item.id}"
      class="dragListItem"
      data-dnd-item-id="${item.id}"
      data-order-key="${item.orderKey}"
    >
      <div
        id="${dragListHandleElementId}"
        class="dragListHandle"
        data-dnd-drag-key="${item.id}"
      ></div>
      <div class="dragListItemText">${item.content}</div>
    </div>
  `;
}

export const renderDragListOverlayContent: DragOverlayContentRenderer<
  DragListItemPayload
> = (payload: DragListItemPayload) => {
  const element = document.createElement("div");
  element.className = "dragListItem";

  const dragHandle = document.createElement("div");
  dragHandle.className = "dragListHandle";

  const content = document.createElement("div");
  content.className = "dragListItemText";
  content.textContent = payload.content;

  element.append(dragHandle, content);

  return element;
};
