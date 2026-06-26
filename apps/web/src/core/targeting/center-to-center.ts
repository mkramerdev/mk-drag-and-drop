import type { TargetingAlgorithm } from './types';
import { findClosestTarget } from './find-closest-target';
import { getRectCenter } from './helpers/get-rect-center';

export const centerToCenter: TargetingAlgorithm = ({
  runtime,
  dropTargets,
}) => {
  if (!runtime.overlayRect) {
    return null;
  }

  return findClosestTarget(getRectCenter(runtime.overlayRect), dropTargets);
};
