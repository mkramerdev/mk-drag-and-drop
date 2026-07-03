export type DragPoint = {
  x: number;
  y: number;
};

export type DragRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DropTarget = {
  dropTargetKey: string;
  dropTargetRect: DragRect;
};

export type TargetingAlgorithmInput = {
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  dropTargets: readonly DropTarget[];
};

export type TargetingAlgorithmMode = "pointer" | "rect";

export type TargetingAlgorithm = {
  (input: TargetingAlgorithmInput): DropTarget | null;
  mode: TargetingAlgorithmMode;
};

export type TargetingConstraintInput = {
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  dropTarget: DropTarget;
};

export type TargetingConstraint = {
  (input: TargetingConstraintInput): boolean;
};

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
