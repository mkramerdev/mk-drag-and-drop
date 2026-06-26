import type { DragRect } from '../types'

export function translateRect(rect: DragRect, deltaX: number, deltaY: number): DragRect {
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