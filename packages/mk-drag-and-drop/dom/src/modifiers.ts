import type { DragPoint, DragRect } from "@mk-drag-and-drop/core";

import { getOverlayRect, rectToDragRect } from "./geometry.js";

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

export function lockToXAxis(): DragModifier {
  return {
    transform: (input) => ({
      x: input.pointerPosition.x,
      y: input.initialPointerPosition.y,
    }),
  };
}

export function lockToYAxis(): DragModifier {
  return {
    transform: (input) => ({
      x: input.initialPointerPosition.x,
      y: input.pointerPosition.y,
    }),
  };
}

export function restrictToContainer(
  getContainer: () => HTMLElement | null,
): DragModifier<DragRect | null> {
  return {
    setup: () => {
      const container = getContainer();

      return container
        ? rectToDragRect(container.getBoundingClientRect())
        : null;
    },
    transform: (input) => {
      if (input.state === null) {
        return input.pointerPosition;
      }

      return {
        x: clampPointerAxis({
          pointerPosition: input.pointerPosition.x,
          overlayStart: input.overlayRect.left,
          overlayEnd: input.overlayRect.right,
          containerStart: input.state.left,
          containerEnd: input.state.right,
        }),
        y: clampPointerAxis({
          pointerPosition: input.pointerPosition.y,
          overlayStart: input.overlayRect.top,
          overlayEnd: input.overlayRect.bottom,
          containerStart: input.state.top,
          containerEnd: input.state.bottom,
        }),
      };
    },
  };
}

function clampPointerAxis(input: {
  pointerPosition: number;
  overlayStart: number;
  overlayEnd: number;
  containerStart: number;
  containerEnd: number;
}): number {
  const overlaySize = input.overlayEnd - input.overlayStart;
  const containerSize = input.containerEnd - input.containerStart;

  if (overlaySize > containerSize) {
    return input.pointerPosition + input.containerStart - input.overlayStart;
  }

  if (input.overlayStart < input.containerStart) {
    return input.pointerPosition + input.containerStart - input.overlayStart;
  }

  if (input.overlayEnd > input.containerEnd) {
    return input.pointerPosition - (input.overlayEnd - input.containerEnd);
  }

  return input.pointerPosition;
}
