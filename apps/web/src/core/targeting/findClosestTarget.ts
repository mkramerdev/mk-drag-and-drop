import type { DragPoint } from '../runtime/types';
import type { DropTarget } from './types';
import { getSquaredDistance } from './helpers/getSquaredDistance';
import { getRectCenter } from './helpers/getRectCenter';

export function findClosestTarget(
  point: DragPoint,
  dropTargets: readonly DropTarget[],
): DropTarget | null {
  let closestTarget: DropTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const dropTarget of dropTargets) {
    const distance = getSquaredDistance(point, getRectCenter(dropTarget.rect));

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTarget = dropTarget;
    }
  }

  return closestTarget;
}