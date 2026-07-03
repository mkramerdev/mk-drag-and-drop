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

type DragModifierInputTransform = {
  bivarianceHack(input: DragModifierTransformInput<unknown>): DragPoint;
}["bivarianceHack"];

export type DragModifierInput = {
  setup?: (input: DragModifierSetupInput) => unknown;
  transform: DragModifierInputTransform;
};

export type ActiveDragModifier = {
  transform: (
    input: Omit<DragModifierTransformInput<unknown>, "state">,
  ) => DragPoint;
};
