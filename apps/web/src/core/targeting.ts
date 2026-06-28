import type { DragPoint, DragRect, DragRuntime } from "./runtime";

export type DropTarget = {
  dropTargetKey: string;
  dropTargetRect: DragRect;
};

export type TargetingAlgorithm = (input: {
  runtime: DragRuntime;
  dropTargets: readonly DropTarget[];
}) => DropTarget | null;

export const pointerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.pointerPosition) {
    return null;
  }

  return findClosestTarget(runtime.pointerPosition, dropTargets);
};

export const centerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.overlayRect) {
    return null;
  }

  return findClosestTarget(getRectCenter(runtime.overlayRect), dropTargets);
};

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
