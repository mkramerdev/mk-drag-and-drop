import type { TargetingAlgorithm } from './types';
import { findClosestTarget } from './findClosestTarget';
import { getRectCenter } from './helpers/getRectCenter';

export const centerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.rect) {
    return null;
  }

  return findClosestTarget(getRectCenter(runtime.rect), dropTargets);
};