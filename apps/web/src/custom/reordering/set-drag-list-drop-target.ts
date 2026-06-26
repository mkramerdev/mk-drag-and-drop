import type { DragListDropTarget } from "../types";

const dragListDropTargets: Record<string, DragListDropTarget> = {};

export function setDragListDropTarget(input: {
  dropTargetId: string;
  beforeItemId: string | null;
}): void {
  dragListDropTargets[input.dropTargetId] = {
    beforeItemId: input.beforeItemId,
  };
}

export function readDragListDropTargets(): Array<
  [string, DragListDropTarget]
> {
  return Object.entries(dragListDropTargets);
}
