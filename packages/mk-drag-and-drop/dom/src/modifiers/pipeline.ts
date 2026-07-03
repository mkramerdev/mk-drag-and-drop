import type { DragPoint, DragRect } from "../geometry/rects.js";
import {
  getOverlayRect,
  type DragOverlayMeasurement,
} from "../geometry/overlay.js";
import type {
  ActiveDragModifier,
  DragModifier,
  DragModifierInput,
  DragModifierSetupInput,
} from "./types.js";

export function createActiveModifier<State>(
  modifier: DragModifier<State>,
  setupInput: DragModifierSetupInput,
): ActiveDragModifier;
export function createActiveModifier(
  modifier: DragModifierInput,
  setupInput: DragModifierSetupInput,
): ActiveDragModifier;
export function createActiveModifier(
  modifier: DragModifierInput,
  setupInput: DragModifierSetupInput,
): ActiveDragModifier {
  const state = modifier.setup?.(setupInput);

  return {
    transform: (input) =>
      modifier.transform({
        ...input,
        state,
      }),
  };
}

export function createActiveDragModifiers(input: {
  modifiers: readonly DragModifierInput[];
  setupInput: DragModifierSetupInput;
}): ActiveDragModifier[] {
  return input.modifiers.map((modifier) =>
    createActiveModifier(modifier, input.setupInput),
  );
}

export function applyDragModifiers(input: {
  activeModifiers: readonly ActiveDragModifier[];
  itemId: string;
  group: string;
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  rawPointerPosition: DragPoint;
  overlayMeasurement?: DragOverlayMeasurement | null;
}): DragPoint {
  let pointerPosition = input.rawPointerPosition;

  for (const activeModifier of input.activeModifiers) {
    const overlayRect = getOverlayRect({
      sourceRect: input.sourceRect,
      initialPointerPosition: input.initialPointerPosition,
      pointerPosition,
      overlayMeasurement: input.overlayMeasurement,
    });

    pointerPosition = activeModifier.transform({
      itemId: input.itemId,
      group: input.group,
      sourceRect: input.sourceRect,
      initialPointerPosition: input.initialPointerPosition,
      rawPointerPosition: input.rawPointerPosition,
      pointerPosition,
      overlayRect,
    });
  }

  return pointerPosition;
}
