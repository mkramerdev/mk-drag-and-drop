import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  type DragController,
  type DragControllerOverlayInput,
} from "../src/index.js";
import {
  createRect,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createDragController", () => {
  let controller: DragController | null = null;

  afterEach(() => {
    controller?.dispose();
    controller = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exposes a stable runtime", () => {
    controller = createDragController();
    const runtime = controller.runtime;

    controller.update({});

    expect(controller.runtime).toBe(runtime);
  });

  it("updates callbacks and config without replacing runtime", () => {
    const firstOnDragStart = vi.fn();
    const secondOnDragStart = vi.fn();
    controller = createDragController({
      keyboardConfiguration: { enabled: false },
      onDragStart: firstOnDragStart,
    });
    const runtime = controller.runtime;

    expect(runtime.isKeyboardDragEnabled()).toBe(false);

    controller.update({
      keyboardConfiguration: { enabled: true },
      onDragStart: secondOnDragStart,
    });

    expect(controller.runtime).toBe(runtime);
    expect(runtime.isKeyboardDragEnabled()).toBe(true);

    startDrag(controller, createElementWithRect());

    expect(firstOnDragStart).not.toHaveBeenCalled();
    expect(secondOnDragStart).toHaveBeenCalledTimes(1);
  });

  it("delegates drop target remeasurement to the runtime", () => {
    controller = createDragController();
    const remeasureSpy = vi.spyOn(controller.runtime, "remeasureDropTargets");
    const input = { group: "items" };

    controller.remeasureDropTargets(input);

    expect(remeasureSpy).toHaveBeenCalledWith(input);
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
    controller.runtime.registerDropTarget("target", target, "items");

    startDrag(controller, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "item" }),
      expect.objectContaining({
        getDropPlacement: expect.any(Function),
        getSortablePlacement: expect.any(Function),
        getDropTargetRect: expect.any(Function),
      }),
    );
    expect(onDragEnd).toHaveBeenCalledWith(
      { itemId: "item", dropTarget: "target" },
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "item", dropTarget: "target" },
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

  it("renders, positions, moves, and removes overlay elements", () => {
    const raf = installMockRaf();
    controller = createDragController({
      dragOverlay: () => {
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

    controller.finishOverlay();

    expect(getOverlayChild()).toBeNull();

    raf.restore();
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
        itemId: "item",
        group: "items",
      },
    });
  });

  it("passes the same drag state to released overlays", () => {
    const raf = installMockRaf();
    const overlayCalls: Array<{
      phase: DragControllerOverlayInput["phase"];
      itemId: string;
      group: string;
    }> = [];
    const target = createElementWithRect(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    controller = createDragController({
      keepOverlayOnDrop: true,
      dragOverlay: ({ dragState, phase }) => {
        overlayCalls.push({
          phase,
          itemId: dragState.itemId,
          group: dragState.group,
        });
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });
    controller.runtime.registerDropTarget("target", target, "items");

    startDrag(controller, createElementWithRect());
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(
      overlayCalls.filter((call) => call.phase === "released").at(-1),
    ).toEqual({
      phase: "released",
      itemId: "item",
      group: "items",
    });

    raf.restore();
  });

  it("creates a live region only when announcements are provided", () => {
    controller = createDragController();

    expect(getLiveRegion()).toBeNull();

    controller.update({
      announcements: {
        onDragStart: () => "Started",
      },
    });

    expect(getLiveRegion()).not.toBeNull();

    controller.update({});

    expect(getLiveRegion()).toBeNull();
  });

  it("cleans active drag state and overlay", () => {
    controller = createDragController({
      dragOverlay: () => {
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });

    startDrag(controller, createElementWithRect());
    expect(controller.runtime.isDragging).toBe(true);
    expect(getOverlayChild()).not.toBeNull();

    controller.cleanup();

    expect(controller.runtime.isDragging).toBe(false);
    expect(getOverlayChild()).toBeNull();
  });

  it("disposes runtime and removes overlay and live region", () => {
    controller = createDragController({
      announcements: {
        onDragStart: () => "Started",
      },
      dragOverlay: () => {
        const element = document.createElement("div");
        element.className = "drag-overlay-child";
        return element;
      },
    });
    const disposeSpy = vi.spyOn(controller.runtime, "dispose");

    startDrag(controller, createElementWithRect());
    expect(getOverlayChild()).not.toBeNull();
    expect(getLiveRegion()).not.toBeNull();

    controller.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(getOverlayChild()).toBeNull();
    expect(getLiveRegion()).toBeNull();
  });
});

function startDrag(
  controller: DragController,
  element: HTMLElement,
  pointerPosition = { x: 0, y: 0 },
): void {
  controller.runtime.requestDragStart({
    itemId: "item",
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

function getOverlayChild(): HTMLElement | null {
  return document.querySelector(".drag-overlay-child");
}

function getLiveRegion(): HTMLElement | null {
  return document.querySelector("[aria-live='polite']");
}
