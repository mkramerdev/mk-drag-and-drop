import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./list-data";
import { generateKeyBetween } from "./fractional-indexing";

export type DropResult = {
  draggedKey: string;
  dropTargetKey: string;
};

type DragListDropTarget = {
  beforeItemId: string | null;
};

const dragListDropTargets: Record<string, DragListDropTarget> = {};

export function setDragListDropTarget(input: {
  dropTargetId: string;
  beforeItemId: string | null;
}): void {
  dragListDropTargets[input.dropTargetId] = {
    beforeItemId: input.beforeItemId,
  };
}

export function getEndDropTargetId(): string | null {
  return (
    Object.entries(dragListDropTargets).find(
      ([, dropTarget]) => dropTarget.beforeItemId === null,
    )?.[0] ?? null
  );
}

export function applyDrop(drop: DropResult): string | null {
  const draggedItem = findDragListItem(dragListItems, drop.draggedKey);
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

function getDragListDropTarget(dropTargetId: string): DragListDropTarget | null {
  return dragListDropTargets[dropTargetId] ?? null;
}

function getDropOrderKey(options: {
  draggedKey: string;
  beforeItemId: string | null;
}): string | null {
  const orderedItems = getOrderedDragListItems().filter(
    (item) => item.id !== options.draggedKey,
  );

  if (options.beforeItemId === options.draggedKey) {
    return null;
  }

  if (options.beforeItemId === null) {
    const previousItem = orderedItems[orderedItems.length - 1];

    return generateKeyBetween(previousItem?.orderKey, null);
  }

  const nextIndex = orderedItems.findIndex(
    (item) => item.id === options.beforeItemId,
  );

  if (nextIndex === -1) {
    return null;
  }

  const previousOrderKey =
    nextIndex > 0 ? orderedItems[nextIndex - 1]!.orderKey : null;
  const nextOrderKey = orderedItems[nextIndex]!.orderKey;

  return generateKeyBetween(previousOrderKey, nextOrderKey);
}
