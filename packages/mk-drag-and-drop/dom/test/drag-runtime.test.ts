import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  centerToCenter,
  pointerToCenter,
  type DragLifecycleCallbacks,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "../src/index.js";
import {
  createDragRuntime,
  type DragRuntime,
} from "../src/runtime/drag-runtime.js";
import {
  createRect,
  dispatchKeyDown,
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
      draggableId: "item-1",
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
        draggableId: "item-1",
        source: "pointer",
        pointerPosition: { x: 4, y: 5 },
        sourceRect: createRect({ width: 40, height: 20 }),
      },
      expect.any(Object),
    );
  });

  it("starts keyboard drags and calls onDragStart with keyboard source", () => {
    const source = createElementWithRect(createRect({ width: 40, height: 20 }));
    const onDragStart = vi.fn();
    configureRuntime(runtime, { onDragStart });

    runtime.requestKeyboardDragStart({
      draggableId: "item-1",
      group: "items",
      element: source,
    });

    expect(runtime.isDragging).toBe(true);
    expect(onDragStart).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "keyboard",
        pointerPosition: { x: 20, y: 10 },
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

    expect(runtime.activeDropTargetId).toBe("target-1");
    expect(onDragUpdate).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        pointerPosition: { x: 110, y: 10 },
        activeDropTargetId: "target-1",
        previousDropTargetId: null,
      },
      expect.any(Object),
    );
  });

  it("passes full geometry to targeting algorithms and constraints without targetingPoint", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const targetingAlgorithmMock = vi.fn(
      (input: Parameters<TargetingAlgorithm>[0]) => input.dropTargets[0] ?? null,
    );
    const targetingAlgorithm: TargetingAlgorithm = Object.assign(
      targetingAlgorithmMock,
      { mode: "pointer" as const },
    );
    const targetingConstraint = vi.fn(
      (_input: Parameters<TargetingConstraint>[0]) => true,
    );

    runtime.configure({
      targetingAlgorithm,
      targetingConstraint,
      hasDragOverlay: false,
      keepOverlayOnDrop: false,
      lifecycleCallbacks: {},
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(targetingAlgorithmMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        targetingPoint: expect.anything(),
      }),
    );
    expect(targetingAlgorithmMock.mock.calls[0]?.[0]).toMatchObject({
      pointerPosition: { x: 110, y: 10 },
      overlayRect: null,
      dropTargets: [
        {
          dropTargetId: "target-1",
          dropTargetRect: createRect({ left: 100, top: 0, width: 20, height: 20 }),
        },
      ],
    });
    expect(targetingConstraint).toHaveBeenCalledWith(
      expect.not.objectContaining({
        targetingPoint: expect.anything(),
      }),
    );
    expect(targetingConstraint.mock.calls[0]?.[0]).toMatchObject({
      pointerPosition: { x: 110, y: 10 },
      overlayRect: null,
      dropTarget: {
        dropTargetId: "target-1",
        dropTargetRect: createRect({ left: 100, top: 0, width: 20, height: 20 }),
      },
    });
  });

  it("keeps placementPosition in drag subscriptions for sortable placement", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const onDragUpdate = vi.fn();

    runtime.configure({
      targetingAlgorithm: centerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: true,
      keepOverlayOnDrop: false,
      lifecycleCallbacks: {},
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
    runtime.subscribe({ onDragUpdate });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 20, clientY: 0 });
    raf.flush();

    expect(onDragUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pointerPosition: { x: 20, y: 0 },
        placementPosition: { x: 25, y: 5 },
      }),
    );
  });

  it("remeasures only the active group when a pointer drag starts", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const firstGroupTarget = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const secondGroupTarget = createMeasuredElement(
      createRect({ left: 200, top: 0, width: 20, height: 20 }),
    );

    runtime.registerDropTarget("target-a", firstGroupTarget.element, "a");
    runtime.registerDropTarget("target-b", secondGroupTarget.element, "b");
    firstGroupTarget.getBoundingClientRect.mockClear();
    secondGroupTarget.getBoundingClientRect.mockClear();

    runtime.requestDragStart({
      draggableId: "item-1",
      group: "a",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 0, y: 0 },
    });

    expect(firstGroupTarget.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(secondGroupTarget.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("remeasures all groups when explicitly requested without input", () => {
    const firstGroupTarget = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const secondGroupTarget = createMeasuredElement(
      createRect({ left: 200, top: 0, width: 20, height: 20 }),
    );

    runtime.registerDropTarget("target-a", firstGroupTarget.element, "a");
    runtime.registerDropTarget("target-b", secondGroupTarget.element, "b");
    firstGroupTarget.getBoundingClientRect.mockClear();
    secondGroupTarget.getBoundingClientRect.mockClear();

    runtime.remeasureDropTargets();

    expect(firstGroupTarget.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(secondGroupTarget.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it("remeasures only the requested group when explicit group input is provided", () => {
    const firstGroupTarget = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const secondGroupTarget = createMeasuredElement(
      createRect({ left: 200, top: 0, width: 20, height: 20 }),
    );

    runtime.registerDropTarget("target-a", firstGroupTarget.element, "a");
    runtime.registerDropTarget("target-b", secondGroupTarget.element, "b");
    firstGroupTarget.getBoundingClientRect.mockClear();
    secondGroupTarget.getBoundingClientRect.mockClear();

    runtime.remeasureDropTargets({ group: "a" });

    expect(firstGroupTarget.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(secondGroupTarget.getBoundingClientRect).not.toHaveBeenCalled();
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
      {
        draggableId: "item-1",
        source: "pointer",
        result: "dropped",
        dropTargetId: "target-1",
      },
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        dropTargetId: "target-1",
      },
      expect.any(Object),
    );

    onDragEnd.mockClear();
    onDrop.mockClear();
    startRuntimeDrag(runtime, source);
    dispatchPointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "no-target",
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("reports invalid-target when the active target is stale on release", () => {
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

    expect(runtime.activeDropTargetId).toBe("target-1");

    target.remove();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "invalid-target",
        dropTargetId: null,
      },
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

    expect(runtime.activeDropTargetId).toBe("container-1");

    runtime.unregisterDropContainer("container-1", target);

    expect(runtime.activeDropTargetId).toBeNull();

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
      {
        draggableId: "item-1",
        source: "pointer",
        result: "canceled",
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();

    onDragEnd.mockClear();
    startRuntimeDrag(runtime, source);
    runtime.cancelDrag();

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "canceled",
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("reports canceled for keyboard Escape", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragEnd, onDrop });

    runtime.requestKeyboardDragStart({
      draggableId: "item-1",
      group: "items",
      element: source,
    });
    dispatchKeyDown(window, "Escape");

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "keyboard",
        result: "canceled",
        dropTargetId: null,
      },
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
    expect(runtime.activeDropTargetId).toBeNull();
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
      {
        draggableId: "item-1",
        source: "pointer",
        dropTargetId: "target-1",
      },
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

  it("self-prunes disconnected binding cleanup records and disposes remaining records", () => {
    const disconnectedCleanup = vi.fn();
    const connectedCleanup = vi.fn();
    let disconnectedRecordConnected = true;

    runtime.registerBindingCleanup({
      cleanup: disconnectedCleanup,
      isConnected: () => disconnectedRecordConnected,
    });
    runtime.registerBindingCleanup({
      cleanup: connectedCleanup,
      isConnected: () => true,
    });

    expect(runtime.getBindingCleanupRecordCount()).toBe(2);

    disconnectedRecordConnected = false;
    runtime.cleanup();

    expect(disconnectedCleanup).toHaveBeenCalledTimes(1);
    expect(connectedCleanup).not.toHaveBeenCalled();
    expect(runtime.getBindingCleanupRecordCount()).toBe(1);

    runtime.dispose();

    expect(disconnectedCleanup).toHaveBeenCalledTimes(1);
    expect(connectedCleanup).toHaveBeenCalledTimes(1);
    expect(runtime.getBindingCleanupRecordCount()).toBe(0);
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
    draggableId: "item-1",
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

function createMeasuredElement(rect: ReturnType<typeof createRect>) {
  const element = document.createElement("div");
  document.body.append(element);
  const getBoundingClientRect = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(rect as DOMRect);

  return { element, getBoundingClientRect };
}
