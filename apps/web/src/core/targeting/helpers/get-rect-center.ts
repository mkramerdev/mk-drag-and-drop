import type { DragRect, DragPoint } from '../../runtime/types';

export function getRectCenter(rect: DragRect): DragPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
