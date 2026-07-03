import type { DragPoint, DragRect } from "../geometry/rects.js";
import { getOverlayRect } from "../geometry/overlay.js";
import type {
  ActiveDragModifier,
  DragModifier,
  DragModifierSetupInput,
} from "./types.js";

export function createActiveDragModifiers(input: {
  modifiers: readonly DragModifier<any>[];
  setupInput: DragModifierSetupInput;
}): ActiveDragModifier[] {
  return input.modifiers.map((modifier) => ({
    modifier,
    state: modifier.setup?.(input.setupInput),
  }));
}

export function applyDragModifiers(input: {
  activeModifiers: readonly ActiveDragModifier[];
  itemId: string;
  group: string;
  sourceRect: DragRect;
  initialPointerPosition: DragPoint;
  rawPointerPosition: DragPoint;
}): DragPoint {
  let pointerPosition = input.rawPointerPosition;

  for (const activeModifier of input.activeModifiers) {
    const overlayRect = getOverlayRect({
      sourceRect: input.sourceRect,
      initialPointerPosition: input.initialPointerPosition,
      pointerPosition,
    });

    pointerPosition = activeModifier.modifier.transform({
      itemId: input.itemId,
      group: input.group,
      sourceRect: input.sourceRect,
      initialPointerPosition: input.initialPointerPosition,
      rawPointerPosition: input.rawPointerPosition,
      pointerPosition,
      overlayRect,
      state: activeModifier.state,
    });
  }

  return pointerPosition;
}
