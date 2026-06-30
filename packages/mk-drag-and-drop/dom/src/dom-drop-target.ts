import type { DragRect, DropTarget } from "@mk-drag-and-drop/core";
import { domRectToDragRect } from "./geometry.js";
import type { DomDragSession } from "./types.js";

export type DomDropTargetHandle = {
  unregister: () => void;
};

export type CreateDomDropTargetOptions = {
  session: DomDragSession;
  dropTargetKey: string;
  dropTargetRect: DragRect;
};

export function createDomDropTarget(
  options: CreateDomDropTargetOptions,
): DomDropTargetHandle {
  const dropTarget = {
    dropTargetKey: options.dropTargetKey,
    dropTargetRect: options.dropTargetRect,
  };

  setDomDropTarget(options.session, dropTarget);

  return {
    unregister: () => {
      removeDomDropTarget(options.session, options.dropTargetKey);
    },
  };
}

export function measureDomElement(element: Element): DragRect {
  return domRectToDragRect(element.getBoundingClientRect());
}

export function setDomDropTarget(
  session: DomDragSession,
  dropTarget: DropTarget,
): void {
  session.dropTargets.set(dropTarget.dropTargetKey, dropTarget.dropTargetRect);
  session.requestDropTargetRetarget?.();
}

export function removeDomDropTarget(
  session: DomDragSession,
  dropTargetKey: string,
): void {
  const didRemoveDropTarget = session.dropTargets.delete(dropTargetKey);

  if (didRemoveDropTarget) {
    session.requestDropTargetRetarget?.();
  }
}

export function getDomDropTargets(session: DomDragSession): DropTarget[] {
  return Array.from(
    session.dropTargets,
    ([dropTargetKey, dropTargetRect]) => ({
      dropTargetKey,
      dropTargetRect,
    }),
  );
}
