import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDroppable,
  type DragController,
} from "../src/index.js";
import { getControllerRuntime } from "../src/controller/controller-internals.js";
import {
  createRect,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createDroppable", () => {
  let controller: DragController | null = null;
  let raf: ReturnType<typeof installMockRaf> | null = null;

  afterEach(() => {
    controller ? getControllerRuntime(controller).releaseActiveDragResources() : undefined;
    controller = null;
    raf?.restore();
    raf = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("registers a drop target that receives matching draggable drops", () => {
    const onDrop = vi.fn();
    const { source, target } = setupDragAndDrop({ onDrop });

    dragToTarget(source, target);

    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item", source: "pointer", dropTargetId: "target" },
      expect.any(Object),
    );
  });

  it("keeps detached pre-mount bindings available after the subtree is mounted", () => {
    const onDrop = vi.fn();
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const root = document.createElement("div");
    const source = createDetachedMeasuredElement(
      createRect({ width: 20, height: 20 }),
    );
    const target = createDetachedMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    root.append(source, target);
    createDroppable({
      controller,
      element: target,
      dropTargetId: "target",
    });
    createDraggable({ controller, element: source, draggableId: "item" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);

    document.body.append(root);
    dragToTarget(source, target);

    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item", source: "pointer", dropTargetId: "target" },
      expect.any(Object),
    );
  });

  it("uses the default group", () => {
    const onDrop = vi.fn();
    const { source, target } = setupDragAndDrop({ onDrop });

    dragToTarget(source, target);

    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("remeasures default-group targets at drag start when public groups are omitted", () => {
    const onDragUpdate = vi.fn();
    controller = createDragController({ onDragUpdate });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const targetMeasure = vi.mocked(target.getBoundingClientRect);

    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({ controller, element: target, dropTargetId: "target" });
    targetMeasure.mockClear();

    dispatchPointerDown(source, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(targetMeasure).toHaveBeenCalledTimes(1);

    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 110,
      clientY: 10,
    });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeDropTargetId: "target" }),
      expect.any(Object),
    );

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
  });

  it("isolates custom groups", () => {
    const onDrop = vi.fn();
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const firstSource = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const secondSource = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDraggable({
      controller,
      element: firstSource,
      draggableId: "other-item",
      group: "other",
    });
    createDraggable({
      controller,
      element: secondSource,
      draggableId: "target-item",
      group: "targets",
    });
    createDroppable({
      controller,
      element: target,
      dropTargetId: "target",
      group: "targets",
    });

    dragToTarget(firstSource, target);

    expect(onDrop).not.toHaveBeenCalled();

    dragToTarget(secondSource, target);

    expect(onDrop).toHaveBeenCalledWith(
      {
        draggableId: "target-item",
        source: "pointer",
        dropTargetId: "target",
      },
      expect.any(Object),
    );
  });

  it("makes a removed target unavailable without cleanup", () => {
    const onDrop = vi.fn();
    const { source, target } = setupDragAndDrop({ onDrop });

    target.remove();
    dragToTarget(source, target);

    expect(onDrop).not.toHaveBeenCalled();
    expect(
      controller
        ? getControllerRuntime(controller).getDropTargetRegistration("target")
        : null,
    ).toBeNull();
  });

  it("self-prunes after the bound target is removed", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDroppable({ controller, element: target, dropTargetId: "target" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);

    target.remove();
    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(0);
    expect(runtime.getDropTargetRegistration("target")).toBeNull();

    document.body.append(target);

    expect(runtime.getDropTargetRegistration("target")).toBeNull();
  });

  it("keeps a newer same-id droppable registration when the old binding self-prunes", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const oldTarget = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );
    const newTarget = createMeasuredElement(
      createRect({ left: 140, top: 0, width: 20, height: 20 }),
    );

    createDroppable({ controller, element: oldTarget, dropTargetId: "target" });
    oldTarget.remove();
    createDroppable({ controller, element: newTarget, dropTargetId: "target" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);
    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);
    expect(runtime.getDropTargetRegistration("target")?.element).toBe(newTarget);
  });

  it("clears the active drop target when its element is removed", () => {
    const onDragUpdate = vi.fn();
    controller = createDragController({ onDragUpdate });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({ controller, element: target, dropTargetId: "target" });

    dispatchPointerDown(source, { pointerId: 1, clientX: 0, clientY: 0 });
    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 110,
      clientY: 10,
    });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeDropTargetId: "target" }),
      expect.any(Object),
    );

    target.remove();
    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 110,
      clientY: 10,
    });
    raf.flush();

    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeDropTargetId: null,
        previousDropTargetId: "target",
      }),
      expect.any(Object),
    );

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
  });

  it("prevents dropping an active target removed before release", () => {
    const onDrop = vi.fn();
    const onDragEnd = vi.fn();
    controller = createDragController({ onDrop, onDragEnd });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({ controller, element: target, dropTargetId: "target" });

    dispatchPointerDown(source, { pointerId: 1, clientX: 0, clientY: 0 });
    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 110,
      clientY: 10,
    });
    raf.flush();

    expect(onDragEnd).not.toHaveBeenCalled();

    target.remove();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        result: "invalid-target",
        dropTargetId: null,
      },
      expect.any(Object),
    );
  });

  function setupDragAndDrop(input: { onDrop: ReturnType<typeof vi.fn> }): {
    source: HTMLElement;
    target: HTMLElement;
  } {
    controller = createDragController({ onDrop: input.onDrop });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({
      controller,
      element: target,
      dropTargetId: "target",
    });

    return {
      source,
      target,
    };
  }

  function dragToTarget(source: HTMLElement, target: HTMLElement): void {
    const targetRect = target.getBoundingClientRect();

    dispatchPointerDown(source, { pointerId: 1, clientX: 0, clientY: 0 });
    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
    });
    raf?.flush();
    dispatchPointerUp(window, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
    });
  }
});

function createMeasuredElement(rect: ReturnType<typeof createRect>): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubBoundingClientRect(element, rect);
  return element;
}

function createDetachedMeasuredElement(
  rect: ReturnType<typeof createRect>,
): HTMLElement {
  const element = document.createElement("div");
  stubBoundingClientRect(element, rect);
  return element;
}
