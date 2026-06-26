import { dragListItems } from "../mock-data";
import { getDragListDropTarget } from "./get-drag-list-drop-target";
import { getDropOrderKey } from "./get-drop-order-key";

export type DropResult = {
  draggedKey: string;
  dropTargetKey: string;
};

export function applyDrop(drop: DropResult): string | null {
  const draggedItem = dragListItems[drop.draggedKey];
  const listDropTarget = getDragListDropTarget(drop.dropTargetKey);

  if (!draggedItem || !listDropTarget) {
    return null;
  }

  const nextOrderKey = getDropOrderKey({
    draggedKey: drop.draggedKey,
    beforeItemId: listDropTarget.beforeItemId,
  });

  if (!nextOrderKey) {
    return null;
  }

  if (nextOrderKey === draggedItem.orderKey) {
    return null;
  }

  draggedItem.orderKey = nextOrderKey;

  return drop.draggedKey;
}
