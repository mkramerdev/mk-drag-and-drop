import { TargetingAlgorithm } from './types';
import { findClosestTarget } from './find-closest-target';

export const pointerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.pointerPosition) {
    return null;
  }

  return findClosestTarget(runtime.pointerPosition, dropTargets);
};
