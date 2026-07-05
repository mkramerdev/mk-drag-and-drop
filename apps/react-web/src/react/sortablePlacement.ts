import type { SortableDropPlacement } from "@mk-drag-and-drop/react";

// Example drop behavior: convert sortable placement into user-owned item order.
export function moveItemToSortablePlacement(
    items: readonly string[],
    draggableId: string,
    placement: SortableDropPlacement,
): string[] {
    const withoutItem = items.filter((item) => item !== draggableId);

    if (placement.targetDraggableId !== null && placement.side !== null) {
        const targetIndex = withoutItem.indexOf(placement.targetDraggableId);

        if (targetIndex === -1) {
            return [...items];
        }

        const insertIndex =
            placement.side === "after" ? targetIndex + 1 : targetIndex;

        return [
            ...withoutItem.slice(0, insertIndex),
            draggableId,
            ...withoutItem.slice(insertIndex),
        ];
    }

    if (placement.previousDraggableId !== null) {
        const previousIndex = withoutItem.indexOf(placement.previousDraggableId);

        if (previousIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, previousIndex + 1),
            draggableId,
            ...withoutItem.slice(previousIndex + 1),
        ];
    }

    if (placement.nextDraggableId !== null) {
        const nextIndex = withoutItem.indexOf(placement.nextDraggableId);

        if (nextIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, nextIndex),
            draggableId,
            ...withoutItem.slice(nextIndex),
        ];
    }

    return [...items];
}
