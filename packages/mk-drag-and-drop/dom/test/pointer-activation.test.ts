import { afterEach, describe, expect, it, vi } from "vitest";

import { PointerActivationController } from "../src/input/pointer-activation.js";
import {
  dispatchPointerCancel,
  dispatchPointerMove,
  dispatchPointerUp,
} from "./test-utils.js";

describe("PointerActivationController", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
        draggableId: "item-1",
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
        draggableId: "item-1",
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
    controller.cancelPendingActivation();
    vi.advanceTimersByTime(100);
    dispatchPointerMove(window, { pointerId: 1, clientX: 20, clientY: 0 });

    expect(activate).not.toHaveBeenCalled();
  });

  it("holds pending resources through activation and always releases them", () => {
    vi.useFakeTimers();
    const releasePendingResources = vi.fn();
    const activate = vi.fn(() => {
      expect(releasePendingResources).not.toHaveBeenCalled();
    });
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: 100,
        activationDistance: null,
      }),
      isDragging: () => false,
      acquirePendingResources: () => releasePendingResources,
      startImmediately: vi.fn(),
      activate,
    });

    controller.request(createRequest());
    vi.advanceTimersByTime(100);

    expect(activate).toHaveBeenCalledTimes(1);
    expect(releasePendingResources).toHaveBeenCalledTimes(1);
  });

  it("releases pending resources on cancellation and activation errors", () => {
    vi.useFakeTimers();
    const canceledRelease = vi.fn();
    const failedRelease = vi.fn();
    const activationError = new Error("activation failed");
    const controller = new PointerActivationController({
      getConfiguration: () => ({
        activationDelay: 100,
        activationDistance: null,
      }),
      isDragging: () => false,
      acquirePendingResources: (request) =>
        request.draggableId === "canceled" ? canceledRelease : failedRelease,
      startImmediately: vi.fn(),
      activate: () => {
        throw activationError;
      },
    });

    controller.request({ ...createRequest(), draggableId: "canceled" });
    controller.cancelPendingActivation();
    expect(canceledRelease).toHaveBeenCalledTimes(1);

    controller.request({ ...createRequest(), draggableId: "failed" });
    expect(() => vi.advanceTimersByTime(100)).toThrow(activationError);
    expect(failedRelease).toHaveBeenCalledTimes(1);
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

  it("clears the activation delay timer on pointerup before activation", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const activate = vi.fn();
    const controller = createDelayedController({ activate });

    controller.request(createRequest());
    dispatchPointerUp(window, { pointerId: 1 });
    vi.advanceTimersByTime(100);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it("clears the activation delay timer on pointercancel before activation", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const activate = vi.fn();
    const controller = createDelayedController({ activate });

    controller.request(createRequest());
    dispatchPointerCancel(window, { pointerId: 1 });
    vi.advanceTimersByTime(100);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it("clears the activation delay timer when activation succeeds", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const activate = vi.fn();
    const controller = createDelayedController({ activate });

    controller.request(createRequest());
    vi.advanceTimersByTime(100);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("cancels pending activation idempotently", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const controller = createDelayedController({ activate: vi.fn() });

    controller.request(createRequest());
    controller.cancelPendingActivation();
    controller.cancelPendingActivation();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
      true,
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
      true,
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
      true,
    );
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(3);
  });

  it("clears delayed activation from the initiating window after adoption", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    expect(frameDocument).not.toBeNull();
    expect(frameWindow).not.toBeNull();
    const element =
      frameDocument?.createElement("div") ?? createRequest().element;
    frameDocument?.body.append(element);
    const frameClearTimeout = vi.spyOn(frameWindow ?? window, "clearTimeout");
    const controller = createDelayedController({ activate: vi.fn() });

    controller.request({ ...createRequest(), element });
    document.adoptNode(element);
    controller.cancelPendingActivation();

    expect(frameClearTimeout).toHaveBeenCalledTimes(1);
    iframe.remove();
  });

  it("does not allow a stale activation timer to start a drag after cancellation", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const controller = createDelayedController({ activate });

    controller.request(createRequest());
    controller.cancelPendingActivation();
    vi.advanceTimersByTime(100);

    expect(activate).not.toHaveBeenCalled();
  });

  it("cancels pending activation without runtime teardown and remains reusable", () => {
    vi.useFakeTimers();
    const activate = vi.fn();
    const controller = createDelayedController({ activate });

    controller.request(createRequest());
    controller.cancelPendingActivation();
    vi.advanceTimersByTime(100);
    controller.request(createRequest());
    vi.advanceTimersByTime(100);

    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("clears pending activation before rethrowing activation errors", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const error = new Error("activation failed");
    const activate = vi.fn(() => {
      throw error;
    });
    const controller = createDelayedController({ activate });

    controller.request(createRequest());

    expect(() => {
      vi.advanceTimersByTime(100);
    }).toThrow(error);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    expect(() => {
      controller.cancelPendingActivation();
    }).not.toThrow();
    expect(activate).toHaveBeenCalledTimes(1);
  });
});

function createDelayedController(input: {
  activate: ReturnType<typeof vi.fn>;
}) {
  return new PointerActivationController({
    getConfiguration: () => ({
      activationDelay: 100,
      activationDistance: null,
    }),
    isDragging: () => false,
    startImmediately: vi.fn(),
    activate: input.activate,
  });
}

function createRequest() {
  const element = document.createElement("div");

  return {
    draggableId: "item-1",
    group: "items",
    element,
    pointerId: 1,
    pointerPosition: { x: 0, y: 0 },
  };
}
