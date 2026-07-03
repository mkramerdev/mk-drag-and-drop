import type { DragRect } from "../geometry/rects.js";
import { rectToDragRect } from "../geometry/rects.js";
import type { DragModifier } from "./types.js";

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
