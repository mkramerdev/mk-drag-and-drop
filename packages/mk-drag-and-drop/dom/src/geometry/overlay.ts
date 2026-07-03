import type { DragPoint, DragRect } from "./rects.js";
import { translateRect } from "./rects.js";

export type DragOverlayMeasurement = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export function getOverlayRect(input: {
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  pointerPosition: DragPoint;
  overlayMeasurement?: DragOverlayMeasurement | null;
}): DragRect {
  const deltaX = input.pointerPosition.x - input.initialPointerPosition.x;
  const deltaY = input.pointerPosition.y - input.initialPointerPosition.y;

  if (input.overlayMeasurement) {
    const left =
      input.sourceRect.left + deltaX + input.overlayMeasurement.offsetX;
    const top =
      input.sourceRect.top + deltaY + input.overlayMeasurement.offsetY;

    return {
      x: left,
      y: top,
      left,
      top,
      width: input.overlayMeasurement.width,
      height: input.overlayMeasurement.height,
      right: left + input.overlayMeasurement.width,
      bottom: top + input.overlayMeasurement.height,
    };
  }

  return translateRect(input.sourceRect, deltaX, deltaY);
}

export function getOverlayMeasurement(input: {
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  pointerPosition: DragPoint;
  overlayRect: DragRect;
}): DragOverlayMeasurement {
  const deltaX = input.pointerPosition.x - input.initialPointerPosition.x;
  const deltaY = input.pointerPosition.y - input.initialPointerPosition.y;
  const wrapperLeft = input.sourceRect.left + deltaX;
  const wrapperTop = input.sourceRect.top + deltaY;

  return {
    offsetX: input.overlayRect.left - wrapperLeft,
    offsetY: input.overlayRect.top - wrapperTop,
    width: input.overlayRect.width,
    height: input.overlayRect.height,
  };
}
