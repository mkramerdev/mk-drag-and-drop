import { TargetingAlgorithm } from './types';
import { findClosestTarget } from './findClosestTarget';

export const pointerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.pointerPosition) {
    return null;
  }

  return findClosestTarget(runtime.pointerPosition, dropTargets);
};