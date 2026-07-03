import { act } from "@testing-library/react";
import { vi } from "vitest";

import type { DragRect } from "../src/index.js";

type RectInput = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type PointerEventInput = {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  button?: number;
  isPrimary?: boolean;
};

export function createRect({
  left = 0,
  top = 0,
  width = 0,
  height = 0,
}: RectInput = {}): DragRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

export function stubBoundingClientRect(
  element: HTMLElement,
  rect: DragRect,
): () => void {
  const stub = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(rect as DOMRect);

  return () => {
    stub.mockRestore();
  };
}

export function dispatchPointerDown(
  target: EventTarget,
  input: PointerEventInput = {},
): boolean {
  return dispatchPointerEvent(target, "pointerdown", input);
}

export function dispatchPointerMove(
  target: EventTarget = window,
  input: PointerEventInput = {},
): boolean {
  return dispatchPointerEvent(target, "pointermove", input);
}

export function dispatchPointerUp(
  target: EventTarget = window,
  input: PointerEventInput = {},
): boolean {
  return dispatchPointerEvent(target, "pointerup", input);
}

export function dispatchPointerCancel(
  target: EventTarget = window,
  input: PointerEventInput = {},
): boolean {
  return dispatchPointerEvent(target, "pointercancel", input);
}

export function dispatchKeyDown(
  target: EventTarget,
  key: string,
): boolean {
  return target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
    }),
  );
}

export function installMockRaf(): {
  flushNext: () => void;
  flush: () => void;
  pendingCount: () => number;
  restore: () => void;
} {
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const requestAnimationFrameStub = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback): number => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
  const cancelAnimationFrameStub = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((frameId: number): void => {
      frames.delete(frameId);
    });

  return {
    flushNext: () => {
      const pendingFrame = frames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;

      if (!pendingFrame) {
        return;
      }

      const [frameId, callback] = pendingFrame;
      frames.delete(frameId);
      callback(frameId);
    },
    flush: () => {
      while (frames.size > 0) {
        const pendingFrames = Array.from(frames.entries());
        frames.clear();

        for (const [frameId, callback] of pendingFrames) {
          callback(frameId);
        }
      }
    },
    pendingCount: () => frames.size,
    restore: () => {
      frames.clear();
      requestAnimationFrameStub.mockRestore();
      cancelAnimationFrameStub.mockRestore();
    },
  };
}

export function actDispatch(callback: () => void): void {
  act(callback);
}

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  input: PointerEventInput,
): boolean {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: input.clientX ?? 0,
    clientY: input.clientY ?? 0,
    button: input.button ?? 0,
  });

  Object.defineProperties(event, {
    pointerId: { value: input.pointerId ?? 1 },
    isPrimary: { value: input.isPrimary ?? true },
  });

  return target.dispatchEvent(event);
}
