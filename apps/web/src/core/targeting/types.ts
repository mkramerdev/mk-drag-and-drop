import type { DragRuntime, DragRect } from '../runtime/types'

export type DropTarget = {
  key: string;
  rect: DragRect;
};

export type TargetingAlgorithmInput = {
  runtime: DragRuntime;
  dropTargets: readonly DropTarget[];
};

export type TargetingAlgorithm = (
  input: TargetingAlgorithmInput,
) => DropTarget | null;