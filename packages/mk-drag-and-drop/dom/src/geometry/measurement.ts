import type { DragRect } from "./rects.js";
import { rectToDragRect } from "./rects.js";

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
