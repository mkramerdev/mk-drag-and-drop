import type { DragPoint, DragRect } from "../geometry/rects.js";
import { getDistanceToRect } from "./constraints.js";
import type {
  DropTarget,
  TargetingAlgorithm,
  TargetingAlgorithmInput,
} from "./types.js";

export const pointerToCenter: TargetingAlgorithm = Object.assign(
  ({ pointerPosition, dropTargets }: TargetingAlgorithmInput) =>
    findClosestTarget(pointerPosition, dropTargets),
  { mode: "pointer" as const },
);

export const centerToCenter: TargetingAlgorithm = Object.assign(
  ({ overlayRect, dropTargets }: TargetingAlgorithmInput) => {
    if (!overlayRect) {
      return null;
    }

    return findClosestTarget(getRectCenter(overlayRect), dropTargets);
  },
  { mode: "rect" as const },
);

export const pointerToRectDistance: TargetingAlgorithm = Object.assign(
  ({ pointerPosition, dropTargets }: TargetingAlgorithmInput) =>
    findClosestTargetByRectDistance(pointerPosition, dropTargets),
  { mode: "pointer" as const },
);

function findClosestTarget(
  point: DragPoint,
  dropTargets: readonly DropTarget[],
): DropTarget | null {
  let closestTarget: DropTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidateDropTarget of dropTargets) {
    const distance = getSquaredDistance(
      point,
      getRectCenter(candidateDropTarget.dropTargetRect),
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTarget = candidateDropTarget;
    }
  }

  return closestTarget;
}

function findClosestTargetByRectDistance(
  point: DragPoint,
  dropTargets: readonly DropTarget[],
): DropTarget | null {
  let closestTarget: DropTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidateDropTarget of dropTargets) {
    const distance = getSquaredRectDistance(
      point,
      candidateDropTarget.dropTargetRect,
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTarget = candidateDropTarget;
    }
  }

  return closestTarget;
}

function getRectCenter(rect: DragRect): DragPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getSquaredDistance(a: DragPoint, b: DragPoint): number {
  const deltaX = a.x - b.x;
  const deltaY = a.y - b.y;

  return deltaX * deltaX + deltaY * deltaY;
}

function getSquaredRectDistance(point: DragPoint, rect: DragRect): number {
  const distance = getDistanceToRect(point, rect);

  return distance.x * distance.x + distance.y * distance.y;
}
