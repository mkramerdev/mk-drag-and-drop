import type { SortableDropPlacement } from "@mk-drag-and-drop/dom";

export function moveItemToSortablePlacement(
  items: readonly string[],
  draggableId: string,
  placement: SortableDropPlacement,
): string[] {
  const withoutItem = items.filter((item) => item !== draggableId);
  let insertIndex = withoutItem.length;
  let resolvedPlacement = false;

  if (placement.targetDraggableId !== null && placement.side !== null) {
    const targetIndex = withoutItem.indexOf(placement.targetDraggableId);

    if (targetIndex !== -1) {
      insertIndex = placement.side === "after" ? targetIndex + 1 : targetIndex;
      resolvedPlacement = true;
    }
  }

  if (!resolvedPlacement && placement.previousDraggableId !== null) {
    const previousIndex = withoutItem.indexOf(placement.previousDraggableId);

    if (previousIndex !== -1) {
      insertIndex = previousIndex + 1;
      resolvedPlacement = true;
    }
  }

  if (!resolvedPlacement && placement.nextDraggableId !== null) {
    const nextIndex = withoutItem.indexOf(placement.nextDraggableId);

    if (nextIndex !== -1) {
      insertIndex = nextIndex;
    }
  }

  return [
    ...withoutItem.slice(0, insertIndex),
    draggableId,
    ...withoutItem.slice(insertIndex),
  ];
}
