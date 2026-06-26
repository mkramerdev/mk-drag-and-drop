import type { DragListItem } from "./types";

import { getDragHandleId } from "./get-drag-handle-id";

export function renderDragItem(itemId: string, item: DragListItem): string {
  const dragHandleId = getDragHandleId(itemId);

  return `
    <div
      id="${itemId}"
      class="dragItem"
      data-dnd-item-id="${itemId}"
      data-order-key="${item.orderKey}"
    >
      <div
        id="${dragHandleId}"
        class="dragHandle"
        data-dnd-drag-handle-id="${dragHandleId}"
        data-dnd-drag-handle-for="${itemId}"
      ></div>
      <div class="dragItemText">${item.content}</div>
    </div>
  `;
}
