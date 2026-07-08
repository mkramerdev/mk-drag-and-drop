import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  type DragController,
  type DragControllerOverlayInput,
} from "../src/index.js";
import { getControllerRuntime } from "../src/controller/controller-internals.js";
import {
  createRect,
  dispatchPointerCancel,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createDragController", () => {
  let controller: DragController | null = null;

  afterEach(() => {
    controller ? getControllerRuntime(controller).releaseActiveDragResources() : undefined;
    controller = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes a stable runtime", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);

    expect(getControllerRuntime(controller)).toBe(runtime);
  });

  it("applies initial callbacks and configuration to the runtime scope", () => {
    const onDragStart = vi.fn();
    controller = createDragController({
      keyboardConfiguration: { enabled: true },
      onDragStart,
    });
    const runtime = getControllerRuntime(controller);

    expect(runtime.isKeyboardDragEnabled()).toBe(true);

    startDrag(controller, createElementWithRect());

    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("delegates drop target remeasurement to the runtime", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");
    const input = { group: "items" };

    controller.remeasureDropTargets(input);

    expect(remeasureSpy).toHaveBeenCalledWith(input);
  });

  it("exposes active drag recomputation on the controller", () => {
    controller = createDragController();
    const recomputeActiveDrag: DragController["recomputeActiveDrag"] =
      controller.recomputeActiveDrag;

    expect(typeof recomputeActiveDrag).toBe("function");
  });

  it("no-ops controller active drag recomputation while idle", () => {
    const onDragUpdate = vi.fn();
    controller = createDragController({ onDragUpdate });

    expect(() => {
      controller?.recomputeActiveDrag();
    }).not.toThrow();
    expect(onDragUpdate).not.toHaveBeenCalled();
  });

  it("delegates active drag recomputation to the runtime", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const recomputeSpy = vi.spyOn(runtime, "recomputeActiveDrag");

    controller.recomputeActiveDrag();

    expect(recomputeSpy).toHaveBeenCalledTimes(1);
  });

  it("fires drag updates when controller recomputes an active drag", () => {
    const onDragUpdate = vi.fn();
    controller = createDragController({ onDragUpdate });

    startDrag(controller, createElementWithRect());
    controller.recomputeActiveDrag();

    expect(onDragUpdate).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        pointerPosition: { x: 0, y: 0 },
        overlayRect: null,
        activeDropTargetId: null,
        previousDropTargetId: null,
      },
      expect.any(Object),
    );
  });

  it("does not remeasure drop targets when controller recomputes an active drag", () => {
    const source = createElementWithRect();
    const target = createMeasuredElement(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController();
    getControllerRuntime(controller).registerDropTarget(
      "target",
      target.element,
      "items",
    );

    startDrag(controller, source);
    target.getBoundingClientRect.mockClear();
    controller.recomputeActiveDrag();

    expect(target.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("exposes active drag recomputation on the runtime scope", () => {
    const onDragUpdate = vi.fn();
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    runtime.subscribe({ onDragUpdate });

    expect(typeof runtime.recomputeActiveDrag).toBe("function");

    startDrag(controller, createElementWithRect());
    runtime.recomputeActiveDrag();

    expect(onDragUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        draggableId: "item",
        source: "pointer",
        pointerPosition: { x: 0, y: 0 },
      }),
    );
  });

  it("does not throw when manually remeasuring without an active overlay", () => {
    controller = createDragController();

    expect(() => controller?.remeasureOverlay()).not.toThrow();
  });

  it("fires lifecycle callbacks through the runtime", () => {
    const raf = installMockRaf();
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    const source = createElementWithRect();
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      onDragStart,
      onDragEnd,
      onDrop,
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "item", source: "pointer" }),
      expect.objectContaining({
        getDropTargetRect: expect.any(Function),
      }),
    );
    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        result: "dropped",
        overlayRect: null,
        dropTargetId: "target",
      },
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item", source: "pointer", dropTargetId: "target" },
      expect.any(Object),
    );

    raf.restore();
  });

  it("fires announcements after user lifecycle callbacks", () => {
    const calls: string[] = [];
    controller = createDragController({
      announcements: {
        onDragStart: () => {
          calls.push("announcement");
          return "Started";
        },
      },
      onDragStart: () => {
        calls.push("user");
      },
    });

    startDrag(controller, createElementWithRect());

    expect(calls).toEqual(["user", "announcement"]);
    expect(getLiveRegion()?.textContent).toBe("Started");
  });

  it("ignores null announcement messages", () => {
    controller = createDragController({
      announcements: {
        onDragStart: () => null,
      },
    });

    startDrag(controller, createElementWithRect());

    expect(getLiveRegion()?.textContent).toBe("");
  });

  it("fires onDragUpdate lifecycle callbacks for every pointer update", () => {
    const raf = installMockRaf();
    const onDragUpdate = vi.fn();
    const source = createElementWithRect();
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({ onDragUpdate });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerMove(window, { pointerId: 1, clientX: 112, clientY: 10 });
    raf.flush();

    expect(onDragUpdate).toHaveBeenCalledTimes(2);
    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeDropTargetId: "target",
        previousDropTargetId: "target",
      }),
      expect.any(Object),
    );

    dispatchPointerUp(window, { pointerId: 1, clientX: 112, clientY: 10 });
    raf.restore();
  });

  it("announces drag updates only when the active drop target changes", () => {
    const raf = installMockRaf();
    const onDragUpdateAnnouncement = vi.fn(({ activeDropTargetId }) =>
      activeDropTargetId ? `Over ${activeDropTargetId}` : "No target",
    );
    const source = createElementWithRect();
    const firstTarget = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    const secondTarget = createElementWithRect(
      createRect({ left: 200, width: 20, height: 20 }),
    );
    controller = createDragController({
      announcements: {
        onDragUpdate: onDragUpdateAnnouncement,
      },
    });
    getControllerRuntime(controller).registerDropTarget(
      "target-1",
      firstTarget,
      "items",
    );
    getControllerRuntime(controller).registerDropTarget(
      "target-2",
      secondTarget,
      "items",
    );

    startDrag(controller, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(1);
    expect(getLiveRegion()?.textContent).toBe("Over target-1");

    dispatchPointerMove(window, { pointerId: 1, clientX: 112, clientY: 10 });
    raf.flush();

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(1);

    dispatchPointerMove(window, { pointerId: 1, clientX: 210, clientY: 10 });
    raf.flush();

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(2);
    expect(getLiveRegion()?.textContent).toBe("Over target-2");

    dispatchPointerUp(window, { pointerId: 1, clientX: 210, clientY: 10 });
    raf.restore();
  });

  it("dedupes repeated identical live-region messages", () => {
    const onDragEndAnnouncement = vi.fn(() => "Same");
    controller = createDragController({
      announcements: {
        onDragStart: () => "Same",
        onDragEnd: onDragEndAnnouncement,
      },
    });

    startDrag(controller, createElementWithRect());

    const firstAnnouncementNode = getLiveRegion()?.firstChild;

    dispatchPointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onDragEndAnnouncement).toHaveBeenCalledTimes(1);
    expect(getLiveRegion()?.firstChild).toBe(firstAnnouncementNode);
    expect(getLiveRegion()?.textContent).toBe("Same");
  });

  it("keeps start, end, and drop announcements", () => {
    const raf = installMockRaf();
    const onDragStartAnnouncement = vi.fn(() => "Started");
    const onDragEndAnnouncement = vi.fn(() => "Ended");
    const onDropAnnouncement = vi.fn(() => "Dropped");
    const source = createElementWithRect();
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      announcements: {
        onDragStart: onDragStartAnnouncement,
        onDragEnd: onDragEndAnnouncement,
        onDrop: onDropAnnouncement,
      },
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, source);

    expect(getLiveRegion()?.textContent).toBe("Started");

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragStartAnnouncement).toHaveBeenCalledTimes(1);
    expect(onDragEndAnnouncement).toHaveBeenCalledTimes(1);
    expect(onDropAnnouncement).toHaveBeenCalledTimes(1);
    expect(getLiveRegion()?.textContent).toBe("Dropped");
    raf.restore();
  });

  it("renders, positions, moves, and removes overlay elements", () => {
    const raf = installMockRaf();
    const overlayInputs: DragControllerOverlayInput[] = [];
    controller = createDragController({
      dragOverlay: (input) => {
        overlayInputs.push(input);
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        element.textContent = "Overlay";
        return element;
      },
    });
    const source = createElementWithRect(
      createRect({ left: 20, top: 30, width: 40, height: 25 }),
    );

    startDrag(controller, source, { x: 4, y: 6 });

    const overlay = getOverlayChild();
    const wrapper = overlay?.parentElement;
    expect(overlay?.textContent).toBe("Overlay");
    expect(overlayInputs.at(-1)).not.toHaveProperty("removeOverlay");
    expect(wrapper?.style.position).toBe("fixed");
    expect(wrapper?.style.left).toBe("20px");
    expect(wrapper?.style.top).toBe("30px");
    expect(wrapper?.style.width).toBe("40px");
    expect(wrapper?.style.height).toBe("25px");
    expect(wrapper?.style.pointerEvents).toBe("none");
    expect(wrapper?.style.zIndex).toBe("9999");
    expect(wrapper?.style.transform).toBe("translate3d(0px, 0px, 0)");

    dispatchPointerMove(window, { pointerId: 1, clientX: 14, clientY: 21 });
    raf.flush();

    expect(getOverlayChild()?.parentElement?.style.transform).toBe(
      "translate3d(10px, 15px, 0)",
    );

    dispatchPointerUp(window, { pointerId: 1, clientX: 14, clientY: 21 });

    expect(getOverlayChild()).toBeNull();

    raf.restore();
  });

  it("creates overlay content once and moves the wrapper on pointer updates", () => {
    const raf = installMockRaf();
    const dragOverlay = vi.fn(() => {
      const element = document.createElement("div");
      element.className = "drag-overlay-child";
      return element;
    });
    controller = createDragController({ dragOverlay });

    startDrag(controller, createElementWithRect(), { x: 4, y: 6 });
    const overlay = getOverlayChild();
    const wrapper = overlay?.parentElement;
    const replaceChildren = wrapper
      ? vi.spyOn(wrapper, "replaceChildren")
      : null;

    dispatchPointerMove(window, { pointerId: 1, clientX: 14, clientY: 21 });
    dispatchPointerMove(window, { pointerId: 1, clientX: 24, clientY: 31 });
    raf.flush();

    expect(dragOverlay).toHaveBeenCalledTimes(1);
    expect(replaceChildren).toHaveBeenCalledTimes(0);
    expect(getOverlayChild()).toBe(overlay);
    expect(wrapper?.style.transform).toBe("translate3d(20px, 25px, 0)");

    raf.restore();
  });

  it("measures overlay content on mount without measuring on pointer updates", () => {
    const raf = installMockRaf();
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    const getBoundingClientRect = vi
      .spyOn(overlayElement, "getBoundingClientRect")
      .mockReturnValue(createRect({ width: 30, height: 40 }) as DOMRect);
    controller = createDragController({
      dragOverlay: () => overlayElement,
    });

    startDrag(controller, createElementWithRect());
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    raf.flush();

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    raf.restore();
  });

  it("manually remeasures mounted overlay content", () => {
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    const getBoundingClientRect = vi
      .spyOn(overlayElement, "getBoundingClientRect")
      .mockReturnValue(createRect({ width: 30, height: 40 }) as DOMRect);
    controller = createDragController({
      dragOverlay: () => overlayElement,
    });

    startDrag(controller, createElementWithRect());
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    controller.remeasureOverlay();

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it("passes overlay remeasurement helper to dragging overlay input", () => {
    let overlayInput: DragControllerOverlayInput | null = null;
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    const getBoundingClientRect = vi
      .spyOn(overlayElement, "getBoundingClientRect")
      .mockReturnValue(createRect({ width: 30, height: 40 }) as DOMRect);
    controller = createDragController({
      dragOverlay: (input) => {
        overlayInput = input;
        expect(() => input.remeasureOverlay()).not.toThrow();
        return overlayElement;
      },
    });

    startDrag(controller, createElementWithRect());
    expect(overlayInput).toMatchObject({
      phase: "dragging",
      remeasureOverlay: expect.any(Function),
    });
    expect(overlayInput).not.toHaveProperty("removeOverlay");
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    overlayInput?.remeasureOverlay();

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it("updates cached overlay geometry after manual overlay remeasurement", () => {
    const targetingAlgorithm = Object.assign(
      vi.fn(() => null),
      { mode: "rect" as const },
    );
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    const getBoundingClientRect = vi
      .spyOn(overlayElement, "getBoundingClientRect")
      .mockReturnValueOnce(createRect({ width: 20, height: 20 }) as DOMRect)
      .mockReturnValue(createRect({ width: 40, height: 30 }) as DOMRect);
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      dragOverlay: () => overlayElement,
      targetingAlgorithm,
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, createElementWithRect());
    expect(targetingAlgorithm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayRect: createRect({ width: 20, height: 20 }),
      }),
    );

    controller.remeasureOverlay();

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
    expect(targetingAlgorithm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayRect: createRect({ width: 40, height: 30 }),
      }),
    );
  });
  it("remeasures overlay content when ResizeObserver reports a resize", () => {
    const resizeObserver = installMockResizeObserver();
    const targetingAlgorithm = Object.assign(
      vi.fn(() => null),
      { mode: "rect" as const },
    );
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    const getBoundingClientRect = vi
      .spyOn(overlayElement, "getBoundingClientRect")
      .mockReturnValueOnce(createRect({ width: 20, height: 20 }) as DOMRect)
      .mockReturnValue(createRect({ width: 40, height: 30 }) as DOMRect);
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      dragOverlay: () => overlayElement,
      targetingAlgorithm,
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, createElementWithRect());
    expect(targetingAlgorithm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayRect: createRect({ width: 20, height: 20 }),
      }),
    );

    resizeObserver.instances[0]?.trigger();

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
    expect(targetingAlgorithm).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overlayRect: createRect({ width: 40, height: 30 }),
      }),
    );
  });

  it("provides cached overlay rects to rect-based targeting", () => {
    const targetingAlgorithm = Object.assign(
      vi.fn(() => null),
      { mode: "rect" as const },
    );
    const overlayElement = document.createElement("div");
    overlayElement.className = "drag-overlay-child";
    vi.spyOn(overlayElement, "getBoundingClientRect").mockReturnValue(
      createRect({ left: 5, top: 6, width: 30, height: 40 }) as DOMRect,
    );
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      dragOverlay: () => overlayElement,
      targetingAlgorithm,
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, createElementWithRect());

    expect(targetingAlgorithm).toHaveBeenCalledWith(
      expect.objectContaining({
        overlayRect: createRect({ left: 5, top: 6, width: 30, height: 40 }),
      }),
    );
  });

  it("passes active drag state to dragOverlay", () => {
    const overlayCalls: DragControllerOverlayInput[] = [];
    controller = createDragController({
      dragOverlay: (input) => {
        overlayCalls.push(input);
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });

    startDrag(controller, createElementWithRect());

    expect(overlayCalls.at(-1)).toMatchObject({
      phase: "dragging",
      dragState: {
        draggableId: "item",
        group: "items",
      },
    });
  });

  it("keeps manual release overlays until removeOverlay is called", () => {
    const raf = installMockRaf();
    let removeReleasedOverlay: (() => void) | null = null;
    let remeasureReleasedOverlay: (() => void) | null = null;
    const overlayCalls: Array<{
      phase: DragControllerOverlayInput["phase"];
      draggableId: string;
      group: string;
      hasRemoveOverlay: boolean;
      hasRemeasureOverlay: boolean;
    }> = [];
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      overlayRelease: "manual",
      dragOverlay: (input) => {
        const { dragState, phase } = input;
        if (phase === "released") {
          removeReleasedOverlay = input.removeOverlay;
          remeasureReleasedOverlay = input.remeasureOverlay;
        }

        overlayCalls.push({
          phase,
          draggableId: dragState.draggableId,
          group: dragState.group,
          hasRemoveOverlay: "removeOverlay" in input,
          hasRemeasureOverlay: typeof input.remeasureOverlay === "function",
        });
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });
    getControllerRuntime(controller).registerDropTarget("target", target, "items");

    startDrag(controller, createElementWithRect());
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(overlayCalls).toEqual([
      {
        phase: "dragging",
        draggableId: "item",
        group: "items",
        hasRemoveOverlay: false,
        hasRemeasureOverlay: true,
      },
      {
        phase: "released",
        draggableId: "item",
        group: "items",
        hasRemoveOverlay: true,
        hasRemeasureOverlay: true,
      },
    ]);
    const releasedOverlay = getOverlayChild();
    expect(releasedOverlay).not.toBeNull();
    expect(remeasureReleasedOverlay).toEqual(expect.any(Function));

    remeasureReleasedOverlay?.();

    expect(getOverlayChild()).toBe(releasedOverlay);

    removeReleasedOverlay?.();
    removeReleasedOverlay?.();

    expect(getOverlayChild()).toBeNull();

    raf.restore();
  });

  it("disconnects overlay resize observation during active drag resource reset", () => {
    const resizeObserver = installMockResizeObserver();
    controller = createDragController({
      dragOverlay: () => {
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });

    startDrag(controller, createElementWithRect());
    getControllerRuntime(controller).releaseActiveDragResources();

    expect(resizeObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(getOverlayChild()).toBeNull();
  });

  it("removes overlay and clears the active drag rect on cancel", () => {
    controller = createDragController({
      dragOverlay: () => {
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });

    startDrag(controller, createElementWithRect());
    expect(getOverlayChild()).not.toBeNull();
    const setOverlayRect = vi.spyOn(
      getControllerRuntime(controller),
      "setOverlayRect",
    );

    dispatchPointerCancel(window, { pointerId: 1 });

    expect(getOverlayChild()).toBeNull();
    expect(setOverlayRect).toHaveBeenCalledWith(null);
  });

  it("allows user code to update dynamic overlay content without replacement", () => {
    const raf = installMockRaf();
    let overlayElement: HTMLElement | null = null;
    controller = createDragController({
      dragOverlay: ({ dragState }) => {
        overlayElement = document.createElement("div");
        overlayElement.className = "drag-overlay-child";
        overlayElement.textContent = dragState.draggableId;
        return overlayElement;
      },
      onDragUpdate: ({ pointerPosition }) => {
        if (overlayElement) {
          overlayElement.textContent = `${pointerPosition.x}, ${pointerPosition.y}`;
        }
      },
      onDragEnd: () => {
        overlayElement = null;
      },
    });

    startDrag(controller, createElementWithRect());
    const mountedOverlay = getOverlayChild();
    dispatchPointerMove(window, { pointerId: 1, clientX: 12, clientY: 18 });
    raf.flush();

    expect(getOverlayChild()).toBe(mountedOverlay);
    expect(getOverlayChild()?.textContent).toBe("12, 18");

    raf.restore();
  });

  it("creates a live region only when announcements are provided", () => {
    controller = createDragController();

    expect(getLiveRegion()).toBeNull();

    controller = createDragController({
      announcements: {
        onDragStart: () => "Started",
      },
    });

    expect(getLiveRegion()).not.toBeNull();
  });

  it("resets active drag state and overlay through active drag resources", () => {
    controller = createDragController({
      dragOverlay: () => {
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });

    startDrag(controller, createElementWithRect());
    expect(getOverlayChild()).not.toBeNull();

    getControllerRuntime(controller).releaseActiveDragResources();

    expect(getOverlayChild()).toBeNull();
  });

  it("exposes only public drag scope operations", () => {
    controller = createDragController({
      announcements: {
        onDragStart: () => "Started",
      },
    });

    expect(Object.keys(controller)).toEqual([
      "remeasureDropTargets",
      "remeasureOverlay",
      "recomputeActiveDrag",
    ]);
    expect(controller).not.toHaveProperty("cleanup");
    expect(controller).not.toHaveProperty("dispose");
    expect(controller).not.toHaveProperty("update");
    expect(controller).not.toHaveProperty("configure");
    expect(controller).not.toHaveProperty("finishOverlay");
    expect(controller).toHaveProperty("remeasureDropTargets");
    expect(controller).toHaveProperty("remeasureOverlay");
    expect(controller).toHaveProperty("recomputeActiveDrag");
  });
});

function startDrag(
  controller: DragController,
  element: HTMLElement,
  pointerPosition = { x: 0, y: 0 },
): void {
  getControllerRuntime(controller).requestDragStart({
    draggableId: "item",
    group: "items",
    element,
    pointerId: 1,
    pointerPosition,
  });
}

function createElementWithRect(
  rect = createRect({ width: 20, height: 20 }),
): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubBoundingClientRect(element, rect);
  return element;
}

function createMeasuredElement(rect: ReturnType<typeof createRect>) {
  const element = document.createElement("div");
  document.body.append(element);
  const getBoundingClientRect = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(rect as DOMRect);

  return { element, getBoundingClientRect };
}

function getOverlayChild(): HTMLElement | null {
  return document.querySelector(".drag-overlay-child");
}

function getLiveRegion(): HTMLElement | null {
  return document.querySelector("[aria-live='polite']");
}

function installMockResizeObserver(): {
  instances: Array<{
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: () => void;
  }>;
} {
  const instances: Array<{
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: () => void;
  }> = [];

  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(private readonly callback: ResizeObserverCallback) {
      instances.push(this);
    }

    trigger(): void {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  return { instances };
}
