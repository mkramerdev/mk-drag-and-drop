import type { DropTarget } from "../../core/targeting/types";
import { convertDomRect } from './convert-to-dom-rect'
import { getDropTargetElements } from "./drop-target-elements";

export function findDropTargets(parent: ParentNode): DropTarget[] {
  return getDropTargetElements(parent)
    .map((element) => {
      const key = element.dataset.dndDropTargetId;

      if (!key) {
        return null;
      }

      return {
        key,
        rect: convertDomRect(element.getBoundingClientRect()),
      };
    })
    .filter((dropTarget): dropTarget is DropTarget => dropTarget !== null);
}
