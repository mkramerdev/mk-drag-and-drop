import type { DragPoint, DragRect } from "../geometry/rects.js";

export type DropTarget = {
  dropTargetId: string;
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
