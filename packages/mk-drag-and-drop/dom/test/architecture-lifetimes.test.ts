import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDropContainer,
  createDroppable,
  createSortable,
  type DragController,
} from "../src/index.js";
import { getControllerRuntime } from "../src/controller/controller-internals.js";
import {
  createRect,
  dispatchKeyDown,
  dispatchPointerCancel,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("architecture lifetimes", () => {
  let activeControllers: DragController[] = [];
  let activeRafs: Array<ReturnType<typeof installMockRaf>> = [];

  afterEach(() => {
    for (const controller of activeControllers) {
      getControllerRuntime(controller).releaseActiveDragResources();
    }

    for (const raf of activeRafs) {
      raf.restore();
    }

    activeControllers = [];
    activeRafs = [];
    document.body.innerHTML = "";
    document.documentElement.style.userSelect = "";
    document.body.style.userSelect = "";
    vi.restoreAllMocks();
  });

  it("binding helpers return void", () => {
    const controller = trackController(createDragController());
    const draggable = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const droppable = createMeasuredElement(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    const container = createMeasuredElement(
      createRect({ left: 200, width: 40, height: 40 }),
    );
    const sortable = createMeasuredElement(
      createRect({ left: 0, top: 40, width: 20, height: 20 }),
    );

    expect(
      createDraggable({ controller, element: draggable, draggableId: "item" }),
    ).toBeUndefined();
    expect(
      createDroppable({
        controller,
        element: droppable,
        dropTargetId: "target",
      }),
    ).toBeUndefined();
    expect(
      createDropContainer({
        controller,
        element: container,
        containerId: "container",
      }),
    ).toBeUndefined();
    expect(
      createSortable({ controller, element: sortable, draggableId: "sortable" }),
    ).toBeUndefined();
  });

  it("vanilla controller and bindings work without public teardown", () => {
    const raf = trackRaf(installMockRaf());
    const drops: string[] = [];
    const controller = trackController(
      createDragController({
        onDrop: ({ draggableId, dropTargetId, sortablePlacement }) => {
          drops.push(
            sortablePlacement
              ? `${draggableId}:${dropTargetId}:sortable`
              : `${draggableId}:${dropTargetId}`,
          );
        },
      }),
    );
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    const container = createMeasuredElement(
      createRect({ left: 0, top: 80, width: 80, height: 80 }),
    );
    const sortableA = createMeasuredElement(
      createRect({ left: 0, top: 80, width: 20, height: 20 }),
    );
    const sortableB = createMeasuredElement(
      createRect({ left: 0, top: 110, width: 20, height: 20 }),
    );

    container.append(sortableA, sortableB);
    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({ controller, element: target, dropTargetId: "target" });
    createDropContainer({
      controller,
      element: container,
      containerId: "container",
      group: "sortables",
    });
    createSortable({
      controller,
      element: sortableA,
      draggableId: "a",
      group: "sortables",
      containerId: "container",
    });
    createSortable({
      controller,
      element: sortableB,
      draggableId: "b",
      group: "sortables",
      containerId: "container",
    });

    dragToTarget({ source, target, raf });
    dragToTarget({ source: sortableA, target: sortableB, raf });

    expect(drops).toEqual(["item:target", "a:b:sortable"]);
    expect(controller).not.toHaveProperty("cleanup");
    expect(controller).not.toHaveProperty("dispose");
  });

  it("prunes disconnected droppables while the runtime remains usable", () => {
    const raf = trackRaf(installMockRaf());
    const onDrop = vi.fn();
    const controller = trackController(createDragController({ onDrop }));
    const runtime = getControllerRuntime(controller);
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const staleTarget = createMeasuredElement(
      createRect({ left: 100, width: 20, height: 20 }),
    );
    const liveTarget = createMeasuredElement(
      createRect({ left: 160, width: 20, height: 20 }),
    );

    createDraggable({ controller, element: source, draggableId: "item" });
    createDroppable({
      controller,
      element: staleTarget,
      dropTargetId: "stale",
    });

    staleTarget.remove();
    controller.remeasureDropTargets();

    expect(runtime.getDropTargetRegistration("stale")).toBeNull();
    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);

    createDroppable({ controller, element: liveTarget, dropTargetId: "live" });
    dragToTarget({ source, target: liveTarget, raf });

    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item", source: "pointer", dropTargetId: "live" },
      expect.any(Object),
    );
  });

  it("prunes disconnected sortables while the runtime remains usable", () => {
    const onDragStart = vi.fn();
    const controller = trackController(createDragController({ onDragStart }));
    const runtime = getControllerRuntime(controller);
    const staleSortable = createMeasuredElement(
      createRect({ width: 20, height: 20 }),
    );
    const liveSortable = createMeasuredElement(
      createRect({ left: 40, width: 20, height: 20 }),
    );

    createSortable({
      controller,
      element: staleSortable,
      draggableId: "stale",
    });
    staleSortable.remove();
    controller.remeasureDropTargets();

    expect(runtime.getDropTargetRegistration("stale")).toBeNull();
    expect(runtime.getStaleDomBindingRecordCount()).toBe(0);

    createSortable({
      controller,
      element: liveSortable,
      draggableId: "live",
    });
    dispatchPointerDown(liveSortable, { pointerId: 1 });

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "live", source: "pointer" }),
      expect.any(Object),
    );
  });

  it("releases pointer window listeners, RAF, and text selection after drop", () => {
    const raf = trackRaf(installMockRaf());
    const removeListener = vi.spyOn(window, "removeEventListener");
    const controller = trackController(createDragController());
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));

    getControllerRuntime(controller).requestDragStart({
      draggableId: "item",
      group: "items",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 0, y: 0 },
    });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(raf.pendingCount()).toBe(1);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });

    expectPointerResourcesReleased({ removeListener, raf });
  });

  it("releases pointer window listeners, RAF, and text selection after cancel", () => {
    const raf = trackRaf(installMockRaf());
    const removeListener = vi.spyOn(window, "removeEventListener");
    const controller = trackController(createDragController());
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));

    getControllerRuntime(controller).requestDragStart({
      draggableId: "item",
      group: "items",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 0, y: 0 },
    });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    getControllerRuntime(controller).cancelDrag();

    expectPointerResourcesReleased({ removeListener, raf });
  });

  it("releases pointer window listeners, RAF, and text selection after pointercancel", () => {
    const raf = trackRaf(installMockRaf());
    const removeListener = vi.spyOn(window, "removeEventListener");
    const controller = trackController(createDragController());
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));

    getControllerRuntime(controller).requestDragStart({
      draggableId: "item",
      group: "items",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 0, y: 0 },
    });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    dispatchPointerCancel(window, { pointerId: 1 });

    expectPointerResourcesReleased({ removeListener, raf });
  });

  it("does not run a queued pointer RAF update after active drag release", () => {
    const raf = trackRaf(installMockRaf());
    const onDragUpdate = vi.fn();
    const controller = trackController(createDragController({ onDragUpdate }));
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const runtime = getControllerRuntime(controller);

    runtime.requestDragStart({
      draggableId: "item",
      group: "items",
      element: source,
      pointerId: 1,
      pointerPosition: { x: 0, y: 0 },
    });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(raf.pendingCount()).toBe(1);

    runtime.releaseActiveDragResources();
    raf.flush();

    expect(raf.pendingCount()).toBe(0);
    expect(onDragUpdate).not.toHaveBeenCalled();
  });

  it("releases keyboard listeners and text selection after keyboard drop and cancel", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const controller = trackController(createDragController());
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));

    createDraggable({ controller, element: source, draggableId: "item" });
    dispatchKeyDown(source, "Space");
    dispatchKeyDown(window, "Enter");

    expect(removeListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
    expect(document.documentElement.style.userSelect).toBe("");
    expect(document.body.style.userSelect).toBe("");

    removeListener.mockClear();
    dispatchKeyDown(source, "Space");
    dispatchKeyDown(window, "Escape");

    expect(removeListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
    expect(document.documentElement.style.userSelect).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("releases keyboard listeners idempotently", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const controller = trackController(createDragController());
    const runtime = getControllerRuntime(controller);
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));

    createDraggable({ controller, element: source, draggableId: "item" });
    dispatchKeyDown(source, "Space");

    runtime.releaseActiveDragResources();
    runtime.releaseActiveDragResources();

    expect(removeListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.userSelect).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("restores sortable preview on drop, cancel, and pointercancel", () => {
    expectSortablePreviewRestores("drop");
    expectSortablePreviewRestores("cancel");
    expectSortablePreviewRestores("pointercancel");
    expectSortablePreviewRestores("active-release");
  });

  function trackController(controller: DragController): DragController {
    activeControllers.push(controller);
    return controller;
  }

  function trackRaf(
    raf: ReturnType<typeof installMockRaf>,
  ): ReturnType<typeof installMockRaf> {
    activeRafs.push(raf);
    return raf;
  }
});

function expectPointerResourcesReleased(input: {
  removeListener: ReturnType<typeof vi.spyOn>;
  raf: ReturnType<typeof installMockRaf>;
}): void {
  expect(input.raf.pendingCount()).toBe(0);
  expect(input.removeListener).toHaveBeenCalledWith(
    "pointermove",
    expect.any(Function),
  );
  expect(input.removeListener).toHaveBeenCalledWith(
    "pointerup",
    expect.any(Function),
  );
  expect(input.removeListener).toHaveBeenCalledWith(
    "pointercancel",
    expect.any(Function),
  );
  expect(document.documentElement.style.userSelect).toBe("");
  expect(document.body.style.userSelect).toBe("");
}

function expectSortablePreviewRestores(
  release: "drop" | "cancel" | "pointercancel" | "active-release",
): void {
  const raf = installMockRaf();
  const controller = createDragController();
  const runtime = getControllerRuntime(controller);
  const { list, a, b } = createSortablePair(controller);

  try {
    dispatchPointerDown(a, { pointerId: 1, clientX: 10, clientY: 10 });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
    raf.flush();

    expect(Array.from(list.children)).toEqual([b, a]);

    if (release === "drop") {
      dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 40 });
    } else if (release === "cancel") {
      runtime.cancelDrag();
    } else if (release === "active-release") {
      runtime.releaseActiveDragResources();
    } else {
      dispatchPointerCancel(window, { pointerId: 1, clientX: 10, clientY: 40 });
    }

    expect(Array.from(list.children)).toEqual([a, b]);
  } finally {
    runtime.releaseActiveDragResources();
    raf.restore();
    document.body.innerHTML = "";
  }
}

function createSortablePair(controller: DragController): {
  list: HTMLElement;
  a: HTMLElement;
  b: HTMLElement;
} {
  const list = document.createElement("div");
  document.body.append(list);
  const a = createMeasuredElement(createRect({ top: 0, width: 20, height: 20 }));
  const b = createMeasuredElement(createRect({ top: 30, width: 20, height: 20 }));

  list.append(a, b);
  createSortable({ controller, element: a, draggableId: "a" });
  createSortable({ controller, element: b, draggableId: "b" });

  return { list, a, b };
}

function dragToTarget(input: {
  source: HTMLElement;
  target: HTMLElement;
  raf: ReturnType<typeof installMockRaf>;
}): void {
  const targetRect = input.target.getBoundingClientRect();
  const targetPosition = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2,
  };

  dispatchPointerDown(input.source, {
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  dispatchPointerMove(window, {
    pointerId: 1,
    clientX: targetPosition.x,
    clientY: targetPosition.y,
  });
  input.raf.flush();
  dispatchPointerUp(window, {
    pointerId: 1,
    clientX: targetPosition.x,
    clientY: targetPosition.y,
  });
}

function createMeasuredElement(rect: ReturnType<typeof createRect>): HTMLElement {
  const element = document.createElement("div");

  document.body.append(element);
  stubBoundingClientRect(element, rect);

  return element;
}
