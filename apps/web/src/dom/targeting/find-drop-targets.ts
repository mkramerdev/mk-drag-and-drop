import type { DropTarget } from "../../core/targeting/types";
import { domRectToDragRect } from './dom-rect-to-drag-rect'
import { getDropTargetElements } from "./drop-target-elements";

export function findDropTargets(parent: ParentNode): DropTarget[] {
  return getDropTargetElements(parent)
    .map((element) => {
      const dropTargetKey = element.dataset.dndDropTargetKey;

      if (!dropTargetKey) {
        return null;
      }

      return {
        dropTargetKey,
        dropTargetRect: domRectToDragRect(element.getBoundingClientRect()),
      };
    })
    .filter(
      (candidateDropTarget): candidateDropTarget is DropTarget =>
        candidateDropTarget !== null,
    );
}
