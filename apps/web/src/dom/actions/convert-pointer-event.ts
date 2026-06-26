import { DragPoint } from '../../core/runtime/types'

export function convertPointerEvent(event: PointerEvent): DragPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}