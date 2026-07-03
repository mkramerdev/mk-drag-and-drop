import type { DragPoint, DragRect } from "./rects.js";
import { translateRect } from "./rects.js";

export function getOverlayRect(input: {
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  pointerPosition: DragPoint;
}): DragRect {
  const deltaX = input.pointerPosition.x - input.initialPointerPosition.x;
  const deltaY = input.pointerPosition.y - input.initialPointerPosition.y;

  return translateRect(input.sourceRect, deltaX, deltaY);
}
