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
    const x = getAxisDistance(
      pointerPosition.x,
      dropTarget.dropTargetRect.left,
      dropTarget.dropTargetRect.right,
    );
    const y = getAxisDistance(
      pointerPosition.y,
      dropTarget.dropTargetRect.top,
      dropTarget.dropTargetRect.bottom,
    );

    if (options.maxXDistance !== undefined && x > options.maxXDistance) {
      return false;
    }

    if (options.maxYDistance !== undefined && y > options.maxYDistance) {
      return false;
    }

    if (
      options.maxDistance !== undefined &&
      x * x + y * y > options.maxDistance * options.maxDistance
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
