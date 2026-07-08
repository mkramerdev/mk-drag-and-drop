import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  centerToCenter,
  lockToXAxis,
  pointerToCenter,
  type DragLifecycleCallbacks,
  type DragModifierInput,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "../src/index.js";
import {
  createDragRuntime,
  type DragRuntime,
} from "../src/runtime/drag-runtime.js";
import { DropTargetRegistry } from "../src/runtime/drop-target-registry.js";
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
    runtime.releaseActiveDragResources();
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
        overlayRect: null,
        activeDropTargetId: "target-1",
        previousDropTargetId: null,
      },
      expect.any(Object),
    );
  });

  it("does not prune disconnected drop targets during pointer updates", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const pruneDisconnectedSpy = vi.spyOn(
      DropTargetRegistry.prototype,
      "pruneDisconnected",
    );
    configureRuntime(runtime, {});
    runtime.registerDropTarget("target-1", target, "items");

    try {
      startRuntimeDrag(runtime, source);
      pruneDisconnectedSpy.mockClear();

      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerMove(window, { pointerId: 1, clientX: 111, clientY: 10 });
      raf.flush();

      expect(runtime.activeDropTargetId).toBe("target-1");
      expect(pruneDisconnectedSpy).not.toHaveBeenCalled();
    } finally {
      pruneDisconnectedSpy.mockRestore();
    }
  });

  it("ignores disconnected drop targets during pointer updates", () => {
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

    target.remove();
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBeNull();
    expect(onDragUpdate).toHaveBeenLastCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        pointerPosition: { x: 110, y: 10 },
        overlayRect: null,
        activeDropTargetId: null,
        previousDropTargetId: "target-1",
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
      overlayRelease: "auto",
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

  it("includes translated source rect fallback in drag updates with an unmeasured overlay", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const onDragUpdate = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragUpdate },
      hasDragOverlay: true,
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 5, clientY: 7 });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pointerPosition: { x: 5, y: 7 },
        overlayRect: createRect({ left: 15, top: 27, width: 30, height: 40 }),
      }),
      expect.any(Object),
    );
  });

  it("includes cached overlay measurements in drag updates", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const onDragUpdate = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragUpdate },
      hasDragOverlay: true,
    });

    startRuntimeDrag(runtime, source);
    runtime.setOverlayRect(
      createRect({ left: 12, top: 23, width: 50, height: 60 }),
    );
    onDragUpdate.mockClear();

    dispatchPointerMove(window, { pointerId: 1, clientX: 7, clientY: 11 });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pointerPosition: { x: 7, y: 11 },
        overlayRect: createRect({ left: 19, top: 34, width: 50, height: 60 }),
      }),
      expect.any(Object),
    );
  });

  it("derives overlayRect from modified pointer movement", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const onDragUpdate = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragUpdate },
      hasDragOverlay: true,
      modifiers: [lockToXAxis()],
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 5, clientY: 7 });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pointerPosition: { x: 5, y: 0 },
        overlayRect: createRect({ left: 15, top: 20, width: 30, height: 40 }),
      }),
      expect.any(Object),
    );
  });

  it("keeps placementPosition in drag subscriptions for sortable placement", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const onDragUpdate = vi.fn();

    runtime.configure({
      targetingAlgorithm: centerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: true,
      overlayRelease: "auto",
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
        overlayRect: null,
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
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("includes translated source rect fallback in drag end with an unmeasured overlay", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const onDragEnd = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragEnd },
      hasDragOverlay: true,
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 5, clientY: 7 });
    dispatchPointerUp(window, { pointerId: 1, clientX: 5, clientY: 7 });

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "no-target",
        overlayRect: createRect({ left: 15, top: 27, width: 30, height: 40 }),
        dropTargetId: null,
      },
      expect.any(Object),
    );
  });

  it("includes cached overlay measurements in drag end", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const onDragEnd = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragEnd },
      hasDragOverlay: true,
    });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    runtime.setOverlayRect(
      createRect({ left: 12, top: 23, width: 50, height: 60 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "dropped",
        overlayRect: createRect({ left: 122, top: 33, width: 50, height: 60 }),
        dropTargetId: "target-1",
      },
      expect.any(Object),
    );
  });

  it("derives drag end overlayRect from modified pointer movement", () => {
    const source = createElementWithRect(
      createRect({ left: 10, top: 20, width: 30, height: 40 }),
    );
    const onDragEnd = vi.fn();
    configureRuntimeWith(runtime, {
      lifecycleCallbacks: { onDragEnd },
      hasDragOverlay: true,
      modifiers: [lockToXAxis()],
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 5, clientY: 7 });
    runtime.cancelDrag();

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "canceled",
        overlayRect: createRect({ left: 15, top: 20, width: 30, height: 40 }),
        dropTargetId: null,
      },
      expect.any(Object),
    );
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
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("explicit remeasure still prunes disconnected drop targets", () => {
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const pruneDisconnectedSpy = vi.spyOn(
      DropTargetRegistry.prototype,
      "pruneDisconnected",
    );
    runtime.registerDropTarget("target-1", target, "items");

    try {
      target.remove();
      runtime.remeasureDropTargets("target-1");

      expect(pruneDisconnectedSpy).toHaveBeenCalledWith(undefined);
      expect(runtime.getDropTargetRegistration("target-1", "items")).toBeNull();
    } finally {
      pruneDisconnectedSpy.mockRestore();
    }
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
        overlayRect: null,
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
        overlayRect: null,
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
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("releases keyboard listeners on invalid-target keyboard drop", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 24, top: 0, width: 10, height: 10 }),
    );
    const onDragEnd = vi.fn();
    const removeListener = vi.spyOn(window, "removeEventListener");
    configureRuntime(runtime, { onDragEnd });
    runtime.registerDropTarget("target-1", target, "items");

    runtime.requestKeyboardDragStart({
      draggableId: "item-1",
      group: "items",
      element: source,
    });
    dispatchKeyDown(window, "ArrowRight");
    expect(runtime.activeDropTargetId).toBe("target-1");

    target.remove();
    dispatchKeyDown(window, "Enter");

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "keyboard",
        result: "invalid-target",
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
    expectActiveResourcesReleased(runtime, raf);
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

  it("releases listeners, text selection suppression, and RAF on active drag reset", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    configureRuntime(runtime, { onDragEnd, onDrop });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(raf.pendingCount()).toBe(1);
    expect(document.documentElement.style.userSelect).toBe("none");

    runtime.releaseActiveDragResources();
    dispatchPointerUp(window, { pointerId: 1 });

    expect(raf.pendingCount()).toBe(0);
    expect(runtime.isDragging).toBe(false);
    expect(document.documentElement.style.userSelect).toBe("");
    expect(document.body.style.userSelect).toBe("");
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("releases active resources and rethrows when onDragStart throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("drag start failed");
    const removeListener = vi.spyOn(window, "removeEventListener");
    configureRuntime(runtime, {
      onDragStart: () => {
        throw error;
      },
    });

    expect(() => {
      startRuntimeDrag(runtime, source);
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
    expectPointerWindowListenersReleased(removeListener);
  });

  it("releases active resources and rethrows when onDragUpdate throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("drag update failed");
    const removeListener = vi.spyOn(window, "removeEventListener");
    configureRuntime(runtime, {
      onDragUpdate: () => {
        throw error;
      },
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(() => {
      raf.flush();
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
    expectPointerWindowListenersReleased(removeListener);
  });

  it("releases active resources and rethrows when onDragEnd throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("drag end failed");
    const removeListener = vi.spyOn(window, "removeEventListener");
    configureRuntime(runtime, {
      onDragEnd: () => {
        throw error;
      },
    });

    startRuntimeDrag(runtime, source);

    expect(() => {
      runtime.endDrag();
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
    expectPointerWindowListenersReleased(removeListener);
  });

  it("releases active resources and rethrows when onDrop throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const target = createElementWithRect(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const error = new Error("drop failed");
    const removeListener = vi.spyOn(window, "removeEventListener");
    configureRuntime(runtime, {
      onDrop: () => {
        throw error;
      },
    });
    runtime.registerDropTarget("target-1", target, "items");

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(() => {
      runtime.endDrag();
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
    expectPointerWindowListenersReleased(removeListener);
  });

  it("releases active resources and rethrows when overlay mount throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("overlay mount failed");
    runtime = createDragRuntime({
      updateOverlayHost: (update) => {
        if (update.type === "mount") {
          throw error;
        }
      },
    });
    configureRuntimeWith(runtime, {
      hasDragOverlay: true,
    });

    expect(() => {
      startRuntimeDrag(runtime, source);
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
  });

  it("releases active resources and rethrows when modifier setup throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("modifier setup failed");
    const modifier: DragModifierInput = {
      setup: () => {
        throw error;
      },
      transform: ({ pointerPosition }) => pointerPosition,
    };
    configureRuntimeWith(runtime, {
      modifiers: [modifier],
    });

    expect(() => {
      startRuntimeDrag(runtime, source);
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
  });

  it("releases active resources and rethrows when modifier transform throws", () => {
    const source = createElementWithRect(createRect({ width: 10, height: 10 }));
    const error = new Error("modifier transform failed");
    const removeListener = vi.spyOn(window, "removeEventListener");
    let transformCalls = 0;
    const modifier: DragModifierInput = {
      transform: ({ pointerPosition }) => {
        transformCalls += 1;

        if (transformCalls > 1) {
          throw error;
        }

        return pointerPosition;
      },
    };
    configureRuntimeWith(runtime, {
      modifiers: [modifier],
    });

    startRuntimeDrag(runtime, source);
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(() => {
      raf.flush();
    }).toThrow(error);

    expectActiveResourcesReleased(runtime, raf);
    expectPointerWindowListenersReleased(removeListener);
  });

  it("does not prune stale DOM binding releases during bulk registration", () => {
    const itemCount = 1_000;
    const records = Array.from({ length: itemCount }, () => ({
      release: vi.fn(),
      isConnected: vi.fn(() => true),
    }));

    for (const record of records) {
      runtime.registerStaleDomBinding(record);
    }

    expect(runtime.getStaleDomBindingRecordCount()).toBe(itemCount);
    expect(getTotalIsConnectedCalls(records)).toBe(itemCount);

    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(itemCount);
    expect(getTotalIsConnectedCalls(records)).toBe(itemCount * 2);
  });

  it("prunes disconnected stale DOM binding records while keeping connected records", () => {
    const disconnectedRelease = vi.fn();
    const connectedRelease = vi.fn();
    let disconnectedRecordConnected = true;

    runtime.registerStaleDomBinding({
      release: disconnectedRelease,
      isConnected: () => disconnectedRecordConnected,
    });
    runtime.registerStaleDomBinding({
      release: connectedRelease,
      isConnected: () => true,
    });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);

    disconnectedRecordConnected = false;
    runtime.pruneDisconnectedDomBindings();

    expect(disconnectedRelease).toHaveBeenCalledTimes(1);
    expect(connectedRelease).not.toHaveBeenCalled();
    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);
  });
});

function configureRuntime(
  runtime: DragRuntime,
  lifecycleCallbacks: DragLifecycleCallbacks,
): void {
  configureRuntimeWith(runtime, { lifecycleCallbacks });
}

function configureRuntimeWith(
  runtime: DragRuntime,
  input: {
    lifecycleCallbacks?: DragLifecycleCallbacks;
    hasDragOverlay?: boolean;
    overlayRelease?: "auto" | "manual";
    modifiers?: readonly DragModifierInput[];
  },
): void {
  runtime.configure({
    targetingAlgorithm: pointerToCenter,
    targetingConstraint: undefined,
    hasDragOverlay: input.hasDragOverlay ?? false,
    overlayRelease: input.overlayRelease ?? "auto",
    lifecycleCallbacks: input.lifecycleCallbacks ?? {},
    keyboardConfiguration: undefined,
    modifiers: input.modifiers ?? [],
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

function getTotalIsConnectedCalls(
  records: { isConnected: ReturnType<typeof vi.fn> }[],
): number {
  return records.reduce(
    (total, record) => total + record.isConnected.mock.calls.length,
    0,
  );
}

function expectActiveResourcesReleased(
  runtime: DragRuntime,
  raf: ReturnType<typeof installMockRaf>,
): void {
  expect(runtime.isDragging).toBe(false);
  expect(raf.pendingCount()).toBe(0);
  expect(document.documentElement.style.userSelect).toBe("");
  expect(document.body.style.userSelect).toBe("");
}

function expectPointerWindowListenersReleased(
  removeListener: ReturnType<typeof vi.spyOn>,
): void {
  expect(removeListener).toHaveBeenCalledWith(
    "pointermove",
    expect.any(Function),
  );
  expect(removeListener).toHaveBeenCalledWith(
    "pointerup",
    expect.any(Function),
  );
  expect(removeListener).toHaveBeenCalledWith(
    "pointercancel",
    expect.any(Function),
  );
}
