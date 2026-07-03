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

export function maxDistanceToRect(
  options: MaxDistanceToRectOptions,
): TargetingConstraint {
  return ({ pointerPosition, dropTarget }) => {
    const distance = getDistanceToRect(
      pointerPosition,
      dropTarget.dropTargetRect,
    );

    if (
      options.maxXDistance !== undefined &&
      distance.x > options.maxXDistance
    ) {
      return false;
    }

    if (
      options.maxYDistance !== undefined &&
      distance.y > options.maxYDistance
    ) {
      return false;
    }

    if (
      options.maxDistance !== undefined &&
      distance.distance > options.maxDistance
    ) {
      return false;
    }

    return true;
  };
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
