import type { DragRect } from "../geometry/rects.js";
import { rectToDragRect } from "../geometry/rects.js";
import type { DragModifier, DragModifierSetupInput } from "./types.js";

export type RestrictToContainerResolver = (
  input: DragModifierSetupInput,
) => HTMLElement | null;

const restrictToContainerElements = new WeakMap<DragRect, HTMLElement>();

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
  getContainer: RestrictToContainerResolver,
): DragModifier<DragRect | null> {
  return {
    setup: (input) => {
      const container = getContainer(input);

      if (!container) {
        return null;
      }

      const rect = rectToDragRect(container.getBoundingClientRect());
      restrictToContainerElements.set(rect, container);
      return rect;
    },
    transform: (input) => {
      if (input.state === null) {
        return input.pointerPosition;
      }

      const containerRect = getRestrictToContainerRect(input.state);

      return {
        x: clampPointerAxis({
          pointerPosition: input.pointerPosition.x,
          overlayStart: input.overlayRect.left,
          overlayEnd: input.overlayRect.right,
          containerStart: containerRect.left,
          containerEnd: containerRect.right,
        }),
        y: clampPointerAxis({
          pointerPosition: input.pointerPosition.y,
          overlayStart: input.overlayRect.top,
          overlayEnd: input.overlayRect.bottom,
          containerStart: containerRect.top,
          containerEnd: containerRect.bottom,
        }),
      };
    },
  };
}

function getRestrictToContainerRect(state: DragRect): DragRect {
  const container = restrictToContainerElements.get(state);

  return container
    ? rectToDragRect(container.getBoundingClientRect())
    : state;
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
