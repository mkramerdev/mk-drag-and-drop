import type { DragListItem } from "./types";

import { renderDragItem } from "./render-drag-item";
import { renderDropTarget } from "./render-drop-target";

export function renderDragListEntry(options: {
  entryId: string;
  dropTargetId: string;
  itemId: string;
  item: DragListItem;
}): string {
  return `
    <div
      id="${options.entryId}"
      class="dragListEntry"
      data-dnd-list-entry-for="${options.itemId}"
    >
      ${renderDropTarget({ dropTargetId: options.dropTargetId })}
      ${renderDragItem(options.itemId, options.item)}
    </div>
  `;
}
