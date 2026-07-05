import type { DragPoint, DragRect } from "../geometry/rects.js";
import type { TargetingConstraint } from "./types.js";

export type RectDistance = {
  x: number;
  y: number;
  distance: number;
};

export type MaxDistanceToRectOptions = {
  maxDistance?: number;
  maxXDistance?: number;
  maxYDistance?: number;
};

export function maxPointerDistanceToRect(
  options: MaxDistanceToRectOptions,
): TargetingConstraint {
  return ({ pointerPosition, dropTarget }) =>
    isPointWithinMaxDistanceToRect({
      point: pointerPosition,
      rect: dropTarget.dropTargetRect,
      options,
    });
}

export function maxOverlayCenterDistanceToRect(
  options: MaxDistanceToRectOptions,
): TargetingConstraint {
  return ({ overlayRect, dropTarget }) => {
    if (!overlayRect) {
      return false;
    }

    return isPointWithinMaxDistanceToRect({
      point: getRectCenter(overlayRect),
      rect: dropTarget.dropTargetRect,
      options,
    });
  };
}

function isPointWithinMaxDistanceToRect(input: {
  point: DragPoint;
  rect: DragRect;
  options: MaxDistanceToRectOptions;
}): boolean {
  const x = getAxisDistance(
    input.point.x,
    input.rect.left,
    input.rect.right,
  );
  const y = getAxisDistance(
    input.point.y,
    input.rect.top,
    input.rect.bottom,
  );

  if (input.options.maxXDistance !== undefined && x > input.options.maxXDistance) {
    return false;
  }

  if (input.options.maxYDistance !== undefined && y > input.options.maxYDistance) {
    return false;
  }

  if (
    input.options.maxDistance !== undefined &&
    x * x + y * y > input.options.maxDistance * input.options.maxDistance
  ) {
    return false;
  }

  return true;
}

export function getDistanceToRect(
  point: DragPoint,
  rect: DragRect,
): RectDistance {
  const x = getAxisDistance(point.x, rect.left, rect.right);
  const y = getAxisDistance(point.y, rect.top, rect.bottom);

  return {
    x,
    y,
    distance: Math.sqrt(x * x + y * y),
  };
}

function getAxisDistance(
  value: number,
  min: number,
  max: number,
): number {
  if (value < min) {
    return min - value;
  }

  if (value > max) {
    return value - max;
  }

  return 0;
}

function getRectCenter(rect: DragRect): DragPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
