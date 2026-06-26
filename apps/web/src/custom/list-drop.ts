import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./list-data";
import { generateKeyBetween } from "./fractional-indexing";

export type DragListDropInput = {
  draggedItemId: string;
  dropTargetKey: string;
};

type DragListDropTarget = {
  beforeItemId: string | null;
};

const dragListDropTargets: Record<string, DragListDropTarget> = {};

export function setDragListDropTarget(input: {
  dropTargetKey: string;
  beforeItemId: string | null;
}): void {
  dragListDropTargets[input.dropTargetKey] = {
    beforeItemId: input.beforeItemId,
  };
}

export function getEndDragListDropTargetKey(): string | null {
  return (
    Object.entries(dragListDropTargets).find(
      ([, dragListDropTarget]) => dragListDropTarget.beforeItemId === null,
    )?.[0] ?? null
  );
}

export function getDragListDropTargetKeyBeforeItem(
  itemId: string,
): string | null {
  return (
    Object.entries(dragListDropTargets).find(
      ([, dragListDropTarget]) => dragListDropTarget.beforeItemId === itemId,
    )?.[0] ?? null
  );
}

export function applyDragListDrop(drop: DragListDropInput): string | null {
  const draggedItem = findDragListItem(dragListItems, drop.draggedItemId);
  const listDropTarget = getDragListDropTarget(drop.dropTargetKey);

  if (!draggedItem || !listDropTarget) {
    return null;
  }

  const nextOrderKey = getDropOrderKey({
    draggedItemId: drop.draggedItemId,
    beforeItemId: listDropTarget.beforeItemId,
  });

  if (!nextOrderKey) {
    return null;
  }

  if (nextOrderKey === draggedItem.orderKey) {
    return null;
  }

  draggedItem.orderKey = nextOrderKey;

  const changedItemId = drop.draggedItemId;

  return changedItemId;
}

function getDragListDropTarget(
  dropTargetKey: string,
): DragListDropTarget | null {
  return dragListDropTargets[dropTargetKey] ?? null;
}

function getDropOrderKey(options: {
  draggedItemId: string;
  beforeItemId: string | null;
}): string | null {
  const orderedItems = getOrderedDragListItems().filter(
    (item) => item.id !== options.draggedItemId,
  );

  if (options.beforeItemId === options.draggedItemId) {
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
