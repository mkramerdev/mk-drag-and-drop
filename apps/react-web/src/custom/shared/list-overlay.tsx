import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

import type {
  DragPoint,
  DragRect,
} from "@mk-drag-and-drop/core";
import type { DragListItem } from "./list-data";

export type DragListOverlay = {
  overlayRect: DragRect;
  move: (pointerPosition: DragPoint) => DragRect;
  remove: () => void;
};

export type DragListOverlayPlacement = "pointer" | "left-center" | "left-top";

export function createOverlay(input: {
  draggedKey: string;
  pointerPosition: DragPoint | null;
  sourceRect: DragRect;
  item: DragListItem;
  placement?: DragListOverlayPlacement;
}): DragListOverlay | null {
  const startPos = input.pointerPosition;

  if (!startPos) {
    return null;
  }

  const placement = input.placement ?? "pointer";
  const initialOverlayRect = getInitialOverlayRect({
    placement,
    overlayRect: input.sourceRect,
    draggedElementRect: input.sourceRect,
    startPos,
  });
  const overlayElement = createDragOverlayElement({
    left: initialOverlayRect.left,
    top: initialOverlayRect.top,
    width: initialOverlayRect.width,
    height: initialOverlayRect.height,
  });
  const root = createRoot(overlayElement);

  overlayElement.dataset.dndDragOverlayKey = input.draggedKey;
  document.body.append(overlayElement);
  root.render(<DragListOverlayContent item={input.item} />);

  let currentPointerPosition = startPos;
  let currentOverlayRect = initialOverlayRect;

  return {
    overlayRect: initialOverlayRect,
    move: (pointerPosition) => {
      const deltaX = pointerPosition.x - currentPointerPosition.x;
      const deltaY = pointerPosition.y - currentPointerPosition.y;
      currentPointerPosition = pointerPosition;
      currentOverlayRect = translateRect(currentOverlayRect, deltaX, deltaY);
      setDragOverlayElementOffset(overlayElement, {
        x: currentOverlayRect.left - initialOverlayRect.left,
        y: currentOverlayRect.top - initialOverlayRect.top,
      });

      return currentOverlayRect;
    },
    remove: () => {
      removeOverlay(root, overlayElement);
    },
  };
}

function DragListOverlayContent(input: { item: DragListItem }): ReactElement {
  return (
    <div className="dragListItem" style={{ margin: 0 }}>
      <div className="dragListHandle" />
      <div className="dragListItemText">{input.item.content}</div>
    </div>
  );
}

function createDragOverlayElement(position: {
  left: number;
  top: number;
  width: number;
  height: number;
}): HTMLDivElement {
  const overlayElement = document.createElement("div");

  overlayElement.dataset.dndDragOverlay = "true";
  overlayElement.style.position = "fixed";
  overlayElement.style.display = "inline-block";
  overlayElement.style.pointerEvents = "none";
  overlayElement.style.zIndex = "9999";
  overlayElement.style.willChange = "transform";
  overlayElement.style.width = `${position.width}px`;
  overlayElement.style.height = `${position.height}px`;
  overlayElement.style.transform = "translate3d(0, 0, 0)";
  setDragOverlayElementPosition(overlayElement, position);

  return overlayElement;
}

function setDragOverlayElementPosition(
  overlayElement: HTMLElement,
  position: {
    left: number;
    top: number;
  },
): void {
  overlayElement.style.left = `${position.left}px`;
  overlayElement.style.top = `${position.top}px`;
}

function setDragOverlayElementOffset(
  overlayElement: HTMLElement,
  offset: {
    x: number;
    y: number;
  },
): void {
  overlayElement.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
}

function getInitialOverlayRect(input: {
  placement: DragListOverlayPlacement;
  overlayRect: DragRect;
  draggedElementRect: DragRect;
  startPos: DragPoint;
}): DragRect {
  const position = getInitialOverlayPosition(input.placement, input);

  return {
    x: position.left,
    y: position.top,
    width: input.overlayRect.width,
    height: input.overlayRect.height,
    top: position.top,
    right: position.left + input.overlayRect.width,
    bottom: position.top + input.overlayRect.height,
    left: position.left,
  };
}

function getInitialOverlayPosition(
  placement: DragListOverlayPlacement,
  input: {
    overlayRect: DragRect;
    draggedElementRect: DragRect;
    startPos: DragPoint;
  },
): {
  left: number;
  top: number;
} {
  if (placement === "left-center") {
    return {
      left: input.draggedElementRect.left,
      top:
        input.draggedElementRect.top +
        input.draggedElementRect.height / 2 -
        input.overlayRect.height / 2,
    };
  }

  if (placement === "left-top") {
    return {
      left: input.draggedElementRect.left,
      top: input.draggedElementRect.top,
    };
  }

  return {
    left: input.startPos.x,
    top: input.startPos.y,
  };
}

function translateRect(rect: DragRect, deltaX: number, deltaY: number): DragRect {
  return {
    x: rect.x + deltaX,
    y: rect.y + deltaY,
    width: rect.width,
    height: rect.height,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    left: rect.left + deltaX,
  };
}

function removeOverlay(root: Root, overlayElement: HTMLElement): void {
  root.unmount();
  overlayElement.remove();
}
