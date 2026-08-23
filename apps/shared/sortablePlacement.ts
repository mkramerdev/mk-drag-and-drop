import type {
  SortableDropPlacement,
  SortablePreview,
} from "@mk-drag-and-drop/dom";

export function applySortablePlacement<Id extends string>(
  orderedIds: readonly Id[],
  draggableId: string,
  placement: SortableDropPlacement,
): Id[] {
  const typedDraggableId = orderedIds.find((id) => id === draggableId);

  if (typedDraggableId === undefined) {
    return [...orderedIds];
  }

  const withoutDragged = orderedIds.filter((id) => id !== draggableId);
  const targetIndex =
    placement.targetDraggableId !== null && placement.side !== null
      ? withoutDragged.findIndex((id) => id === placement.targetDraggableId)
      : -1;

  if (targetIndex !== -1) {
    const insertionIndex =
      placement.side === "after" ? targetIndex + 1 : targetIndex;

    return insertAt(withoutDragged, insertionIndex, typedDraggableId);
  }

  const previousIndex =
    placement.previousDraggableId === null
      ? -1
      : withoutDragged.findIndex((id) => id === placement.previousDraggableId);

  if (previousIndex !== -1) {
    return insertAt(withoutDragged, previousIndex + 1, typedDraggableId);
  }

  const nextIndex =
    placement.nextDraggableId === null
      ? -1
      : withoutDragged.findIndex((id) => id === placement.nextDraggableId);

  if (nextIndex !== -1) {
    return insertAt(withoutDragged, nextIndex, typedDraggableId);
  }

  if (
    placement.targetDraggableId === null &&
    placement.previousDraggableId === null &&
    placement.nextDraggableId === null
  ) {
    return [typedDraggableId];
  }

  return [...orderedIds];
}

export function applySortablePreview<Id extends string>(
  canonicalOrder: readonly Id[],
  draggableId: string,
  preview: SortablePreview,
): Id[] {
  return preview.status === "projected"
    ? applySortablePlacement(canonicalOrder, draggableId, preview.placement)
    : [...canonicalOrder];
}

export function ordersEqual<Id extends string>(
  first: readonly Id[],
  second: readonly Id[],
): boolean {
  return (
    first.length === second.length &&
    first.every((id, index) => id === second[index])
  );
}

export function formatSortablePreviewAnchors(preview: SortablePreview): string {
  if (preview.status === "inactive") {
    return JSON.stringify({ status: preview.status });
  }

  return JSON.stringify({
    status: preview.status,
    containerId: preview.placement.containerId,
    previousDraggableId: preview.placement.previousDraggableId,
    nextDraggableId: preview.placement.nextDraggableId,
    targetDraggableId: preview.placement.targetDraggableId,
    side: preview.placement.side,
  });
}

function insertAt<Id extends string>(
  orderedIds: readonly Id[],
  index: number,
  draggableId: Id,
): Id[] {
  return [
    ...orderedIds.slice(0, index),
    draggableId,
    ...orderedIds.slice(index),
  ];
}
