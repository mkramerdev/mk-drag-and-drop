import type { DragPoint } from '../runtime/types';
import type { DropTarget } from './types';
import { getSquaredDistance } from './helpers/get-squared-distance';
import { getRectCenter } from './helpers/get-rect-center';

export function findClosestTarget(
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
