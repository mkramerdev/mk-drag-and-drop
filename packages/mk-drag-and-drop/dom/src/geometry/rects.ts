export type DragPoint = {
  x: number;
  y: number;
};

export type DragRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

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
