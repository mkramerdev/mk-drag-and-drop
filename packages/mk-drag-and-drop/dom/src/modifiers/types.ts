import type { DragPoint, DragRect } from "../geometry/rects.js";

export type DragModifierSetupInput = {
  itemId: string;
  group: string;
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
};

export type DragModifierTransformInput<State = unknown> = {
  itemId: string;
  group: string;
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  rawPointerPosition: DragPoint;
  pointerPosition: DragPoint;
  overlayRect: DragRect;
  state: State;
};

export type DragModifier<State = unknown> = {
  setup?: (input: DragModifierSetupInput) => State;
  transform: (input: DragModifierTransformInput<State>) => DragPoint;
};

export type ActiveDragModifier = {
  modifier: DragModifier<any>;
  state: any;
};
