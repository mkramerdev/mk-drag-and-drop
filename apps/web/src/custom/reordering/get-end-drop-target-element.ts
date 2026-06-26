import { getDropTargetElement } from "./get-drop-target-element";
import { readDragListDropTargets } from "./set-drag-list-drop-target";

export function getEndDropTargetElement(): HTMLElement | null {
  const entry = readDragListDropTargets().find(
    ([, dropTarget]) => dropTarget.beforeItemId === null,
  );

  return entry ? getDropTargetElement(entry[0]) : null;
}
