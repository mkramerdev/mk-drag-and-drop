import type { DropTarget } from "../../core/targeting/types";
import { convertDomRect } from './convert-to-dom-rect'

export function findDropTargets(parent: ParentNode): DropTarget[] {
  return Array.from(
    parent.querySelectorAll<HTMLElement>("[data-dnd-drop-target-id]"),
    (element) => {
      const key = element.dataset.dndDropTargetId;

      if (!key) {
        return null;
      }

      return {
        key,
        rect: convertDomRect(element.getBoundingClientRect()),
      };
    },
  ).filter((dropTarget): dropTarget is DropTarget => dropTarget !== null);
}