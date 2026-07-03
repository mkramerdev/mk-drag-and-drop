import type { DragPoint, DragRect } from "@mk-drag-and-drop/core";

export const emptyDragRect: DragRect = {
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
};

export function rectToDragRect(rect: DOMRectReadOnly): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function translateRect(
  rect: DragRect,
  deltaX: number,
  deltaY: number,
): DragRect {
  return {
    x: rect.x + deltaX,
    y: rect.y + deltaY,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    left: rect.left + deltaX,
    width: rect.width,
    height: rect.height,
  };
}

export function getOverlayRect(input: {
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  pointerPosition: DragPoint;
}): DragRect {
  const deltaX = input.pointerPosition.x - input.initialPointerPosition.x;
  const deltaY = input.pointerPosition.y - input.initialPointerPosition.y;

  return translateRect(input.sourceRect, deltaX, deltaY);
}

export function measureDomElement(element: HTMLElement): DragRect {
  return rectToDragRect(element.getBoundingClientRect());
}

export function measureDocumentRect(element: HTMLElement): DragRect {
  const viewportRect = element.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    x: viewportRect.x + scrollX,
    y: viewportRect.y + scrollY,
    top: viewportRect.top + scrollY,
    right: viewportRect.right + scrollX,
    bottom: viewportRect.bottom + scrollY,
    left: viewportRect.left + scrollX,
    width: viewportRect.width,
    height: viewportRect.height,
  };
}

export function documentRectToViewportRect(rect: DragRect): DragRect {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    x: rect.x - scrollX,
    y: rect.y - scrollY,
    top: rect.top - scrollY,
    right: rect.right - scrollX,
    bottom: rect.bottom - scrollY,
    left: rect.left - scrollX,
    width: rect.width,
    height: rect.height,
  };
}
