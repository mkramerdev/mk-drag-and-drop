import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDragRuntime,
  pointerToCenter,
  type DragLifecycleCallbacks,
  type DragRuntime,
} from "../src/index.js";
import {
  createRect,
  dispatchPointerCancel,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("DragRuntime", () => {
  let runtime: DragRuntime;
  let raf: ReturnType<typeof installMockRaf>;

  beforeEach(() => {
    document.body.innerHTML = "";
    raf = installMockRaf();
    runtime = createDragRuntime();
  });

  afterEach(() => {
    runtime.dispose();
    raf.restore();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("starts pointer drags and calls onDragStart", () => {
    const source = createElementWithRect(createRect({ width: 40, height: 20 }));
    const onDragStart = vi.fn();
    configureRuntime(runtime, { onDragStart });

    runtime.requestDragStart({
      itemId: "item-1",
      group: "items",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 4, y: 5 },
    });

    expect(runtime.isDragging).toBe(true);
    expect(runtime.draggedId).toBe("item-1");
    expect(document.documentElement.style.userSelect).toBe("none");
    expect(document.body.style.userSelect).toBe("none");
    expect(onDragStart).toHaveBeenCalledWith(
      {
        itemId: "item-1",
        pointerPosition: { x: 4, y: 5 },
        sourceRect: createRect({ width: 40, height: 20 }),
      },
      expect.any(Object),
    );
  });

  it("updates active drop target on pointer move", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDragUpdate = vi.fn();
    configureRuntime(runtime, { onDragUpdate });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTarget).toBe("target-1");
    expect(onDragUpdate).toHaveBeenCalledWith(
      {
        itemId: "item-1",
        pointerPosition: { x: 110, y: 10 },
        activeDropTarget: "target-1",
        previousDropTarget: null,
      },
      expect.any(Object),
    );
  });

  it("calls onDrop only for valid drop targets", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragEnd, onDrop });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragEnd).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: "target-1" },
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: "target-1" },
      expect.any(Object),
    );

    onDragEnd.mockClear();
    onDrop.mockClear();
    startRuntimeDrag(runtime, source);
    dispatchPointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onDragEnd).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: null },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("clears stale active container targets when they unregister", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDrop });
    runtime.registerDropContainer("container-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTarget).toBe("container-1");

    runtime.unregisterDropContainer("container-1", target);

    expect(runtime.activeDropTarget).toBeNull();

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does not call onDrop on cancel or pointercancel", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragEnd, onDrop });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerCancel(window, { pointerId: 1 });

    expect(onDragEnd).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: null },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();

    onDragEnd.mockClear();
    startRuntimeDrag(runtime, source);
    runtime.cancelDrag();

    expect(onDragEnd).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: null },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("ignores pointer events from another pointerId", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDragUpdate = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragUpdate, onDrop });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 2, clientX: 110, clientY: 10 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 2, clientX: 110, clientY: 10 });

    expect(runtime.isDragging).toBe(true);
    expect(runtime.activeDropTarget).toBeNull();
    expect(onDragUpdate).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("flushes queued RAF pointer updates before drop", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDrop });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    expect(raf.pendingCount()).toBe(1);

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(raf.pendingCount()).toBe(0);
    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: "target-1" },
      expect.any(Object),
    );
  });

  it("cleans listeners, text selection suppression, and RAF on cleanup", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragEnd, onDrop });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(raf.pendingCount()).toBe(1);
    expect(document.documentElement.style.userSelect).toBe("none");

    runtime.cleanup();
    dispatchPointerUp(window, { pointerId: 1 });

    expect(raf.pendingCount()).toBe(0);
    expect(runtime.isDragging).toBe(false);
    expect(document.documentElement.style.userSelect).toBe("");
    expect(document.body.style.userSelect).toBe("");
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });
});

function configureRuntime(
  runtime: DragRuntime,
  lifecycleCallbacks: DragLifecycleCallbacks,
): void {
  runtime.configure({
    targetingAlgorithm: pointerToCenter,
    targetingConstraint: undefined,
    hasDragOverlay: false,
    keepOverlayOnDrop: false,
    lifecycleCallbacks,
    keyboardConfiguration: undefined,
    modifiers: [],
    pointerConfiguration: undefined,
  });
}

function startRuntimeDrag(runtime: DragRuntime, source: HTMLElement): void {
  runtime.requestDragStart({
    itemId: "item-1",
    group: "items",
    element: source,
    pointerId: 1,
    pointerPosition: { x: 0, y: 0 },
  });
}

function createElementWithRect(rect: ReturnType<typeof createRect>): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubBoundingClientRect(element, rect);
  return element;
}
