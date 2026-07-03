import { afterEach, describe, expect, it, vi } from "vitest";

import { PointerActivationController } from "../src/index.js";
import { dispatchPointerMove, dispatchPointerUp } from "./test-utils.js";

describe("PointerActivationController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("activates immediately when no thresholds are configured", () => {
    const startImmediately = vi.fn();
    const activate = vi.fn();
    const request = createRequest();
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: null,
        activationDistance: null,
      }),
      isDragging: () => false,
      startImmediately,
      activate,
    });

    controller.request(request);

    expect(startImmediately).toHaveBeenCalledWith(request);
    expect(activate).not.toHaveBeenCalled();
  });

  it("activates after a configured delay", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: 100,
        activationDistance: null,
      }),
      isDragging: () => false,
      startImmediately: vi.fn(),
      activate,
    });

    controller.request(createRequest());
    expect(activate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        pointerId: 1,
        initialPointerPosition: { x: 0, y: 0 },
        latestPointerPosition: { x: 0, y: 0 },
      }),
    );
  });

  it("activates after configured pointer distance and filters pointerId", () => {
    const activate = vi.fn();
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: null,
        activationDistance: 10,
      }),
      isDragging: () => false,
      startImmediately: vi.fn(),
      activate,
    });

    controller.request(createRequest());
    dispatchPointerMove(window, { pointerId: 2, clientX: 20, clientY: 0 });
    dispatchPointerMove(window, { pointerId: 1, clientX: 6, clientY: 0 });
    expect(activate).not.toHaveBeenCalled();

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 0 });

    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        pointerId: 1,
        latestPointerPosition: { x: 10, y: 0 },
      }),
    );
  });

  it("cancels pending activation and clears timers/listeners", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: 100,
        activationDistance: 10,
      }),
      isDragging: () => false,
      startImmediately: vi.fn(),
      activate,
    });

    controller.request(createRequest());
    controller.cancel();
    vi.advanceTimersByTime(100);
    dispatchPointerMove(window, { pointerId: 1, clientX: 20, clientY: 0 });

    expect(activate).not.toHaveBeenCalled();
  });

  it("cancels pending activation on matching pointer end", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: 100,
        activationDistance: null,
      }),
      isDragging: () => false,
      startImmediately: vi.fn(),
      activate,
    });

    controller.request(createRequest());
    dispatchPointerUp(window, { pointerId: 2 });
    vi.advanceTimersByTime(99);
    expect(activate).not.toHaveBeenCalled();

    dispatchPointerUp(window, { pointerId: 1 });
    vi.advanceTimersByTime(1);

    expect(activate).not.toHaveBeenCalled();
  });
});

function createRequest() {
  const element = document.createElement("div");

  return {
    itemId: "item-1",
    group: "items",
    element,
    pointerId: 1,
    pointerPosition: { x: 0, y: 0 },
  };
}
