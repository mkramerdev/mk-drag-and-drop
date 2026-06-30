import type { DragListItem } from "../shared/list-data";
import {
  findDragListItem,
  getOrderedDragListItems,
} from "../shared/list-data";
import { generateKeyBetween } from "../shared/fractional-indexing";

export type DragListDropInput = {
  items: readonly DragListItem[];
  dropTargets: DragListDropTargetRegistry;
  draggedItemId: string;
  dropTargetKey: string;
};

export type DragListDropTarget = {
  beforeItemId: string | null;
};

export type SetDragListDropTargetInput = {
  dropTargetKey: string;
  beforeItemId: string | null;
};

export type DragListDropTargetRegistry = {
  setDropTarget: (input: SetDragListDropTargetInput) => void;
  getDropTarget: (dropTargetKey: string) => DragListDropTarget | null;
  getDropTargetKeyBeforeItem: (itemId: string) => string | null;
  getEndDropTargetKey: () => string | null;
};

export function createDragListDropTargetRegistry(): DragListDropTargetRegistry {
  const dropTargets = new Map<string, DragListDropTarget>();

  return {
    setDropTarget: (input) => {
      dropTargets.set(input.dropTargetKey, {
        beforeItemId: input.beforeItemId,
      });
    },
    getDropTarget: (dropTargetKey) => dropTargets.get(dropTargetKey) ?? null,
    getDropTargetKeyBeforeItem: (itemId) =>
      findDropTargetKey(dropTargets, (dropTarget) => {
        return dropTarget.beforeItemId === itemId;
      }),
    getEndDropTargetKey: () =>
      findDropTargetKey(dropTargets, (dropTarget) => {
        return dropTarget.beforeItemId === null;
      }),
  };
}

export function applyDragListDrop(drop: DragListDropInput): string | null {
  const draggedItem = findDragListItem(drop.items, drop.draggedItemId);
  const listDropTarget = drop.dropTargets.getDropTarget(drop.dropTargetKey);

  if (!draggedItem || !listDropTarget) {
    return null;
  }

  const nextOrderKey = getDropOrderKey({
    items: drop.items,
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

function getDropOrderKey(options: {
  items: readonly DragListItem[];
  draggedItemId: string;
  beforeItemId: string | null;
}): string | null {
  const orderedItems = getOrderedDragListItems(options.items).filter(
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

function findDropTargetKey(
  dropTargets: ReadonlyMap<string, DragListDropTarget>,
  predicate: (dropTarget: DragListDropTarget) => boolean,
): string | null {
  for (const [dropTargetKey, dropTarget] of dropTargets) {
    if (predicate(dropTarget)) {
      return dropTargetKey;
    }
  }

  return null;
}
