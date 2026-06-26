import type { DragListDropTarget } from "../types";

import { readDragListDropTargets } from "./set-drag-list-drop-target";

export function getDragListDropTarget(
  dropTargetId: string,
): DragListDropTarget | null {
  return (
    readDragListDropTargets().find(([targetId]) => targetId === dropTargetId)
      ?.[1] ?? null
  );
}
