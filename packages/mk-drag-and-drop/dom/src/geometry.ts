import type { DragRect } from "@mk-drag-and-drop/core";

export function domRectToDragRect(rect: DOMRect): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}
