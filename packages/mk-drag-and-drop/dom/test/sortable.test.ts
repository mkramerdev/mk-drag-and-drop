import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  centerToCenter,
  pointerToCenter,
  type SortableDropPlacement,
} from "../src/index.js";
import {
  createDomDropContainer,
  createDomSortable,
} from "../src/integration/index.js";
import {
  createDragRuntime,
  type DragRuntime,
} from "../src/runtime/drag-runtime.js";
import {
  createPointerHandlerEvent,
  createRect,
  dispatchPointerCancel,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

type SortableTestOptions = Partial<
  Pick<Parameters<typeof createDomSortable>[0], "axis" | "placementBoundary">
>;

describe("createDomSortable", () => {
  let runtime: DragRuntime;
  let raf: ReturnType<typeof installMockRaf>;

  beforeEach(() => {
    document.body.innerHTML = "";
    raf = installMockRaf();
    runtime = createDragRuntime();
    runtime.configure({
      targetingAlgorithm: pointerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: false,
      keepOverlayOnDrop: false,
      lifecycleCallbacks: {},
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
  });

  afterEach(() => {
    runtime.dispose();
    raf.restore();
    document.body.innerHTML = "";
  });

  it("registers sortable items as drop targets", () => {
    const item = createSortableElement("a", createRect({ width: 20, height: 20 }));
    const sortable = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => item,
    });

    sortable.setElement(item);

    expect(runtime.getDropTargetRect("a")).toEqual(
      createRect({ width: 20, height: 20 }),
    );
    expect(runtime.getDropTargetRegistration("a", "rows")).toMatchObject({
      id: "a",
      group: "rows",
      containerId: null,
      capabilities: {
        container: false,
        sortable: true,
      },
    });
  });

  it("stores sortable containerId on item registration", () => {
    const item = createSortableElement("a", createRect({ width: 20, height: 20 }));
    const sortable = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      containerId: "column-1",
      getElement: () => item,
    });

    sortable.setElement(item);

    expect(runtime.getDropTargetRegistration("a", "rows")).toMatchObject({
      containerId: "column-1",
      capabilities: {
        container: false,
        sortable: true,
      },
    });
  });

  it("defaults to vertical axis and restores snapshot on cancel", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(a.dataset.dndDragged).toBe("true");

    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expect(a.dataset.dndSortableDraggable).toBe("true");
  });

  it("does not oscillate on repeated pointer frames over the same active target", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 36 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 36 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("does not oscillate after a preview DOM mutation changes item order", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 44 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 44 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);
  });

  it("restores snapshot position without falling back to end when the original next sibling is removed", () => {
    const { elements, behaviors } = createFourItemSortableList();
    const [a, b, c, d] = elements;

    behaviors.b.onPointerDown(createPointerHandlerEvent({ target: b }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 100 });
    raf.flush();

    expect(Array.from(b.parentElement?.children ?? [])).toEqual([a, c, d, b]);

    c.remove();
    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();

    expect(Array.from(b.parentElement?.children ?? [])).toEqual([a, b, d]);
  });

  it("switches promptly for compact rows at the forward placement boundary", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 36 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("uses an explicit horizontal axis without DOM layout inference", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      axis: "horizontal",
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 4, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 6, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("uses custom placementBoundary.start for movement toward axis end", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { start: 0.5 },
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 39 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("uses custom placementBoundary.end for movement toward axis start", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { end: 0.5 },
    });
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, b, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 39 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);
  });

  it("normalizes placement boundary ratios", () => {
    const first = createSortableList(undefined, {
      placementBoundary: { start: -1 },
    });
    const [firstA, firstB, firstC] = first.elements;

    first.behaviors.a.onPointerDown(createPointerHandlerEvent({ target: firstA }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(firstA.parentElement?.children ?? [])).toEqual([
      firstB,
      firstA,
      firstC,
    ]);

    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();
    firstA.parentElement?.remove();

    const second = createSortableList(undefined, {
      placementBoundary: { start: Number.NaN },
    });
    const [secondA, secondB, secondC] = second.elements;

    second.behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: secondA }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(secondA.parentElement?.children ?? [])).toEqual([
      secondA,
      secondB,
      secondC,
    ]);
  });

  it("uses the forward boundary for tall targets and can change side on the same active target", () => {
    const { elements, behaviors } = createTallSortableList();
    const [a, b] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 195 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 221 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a]);
  });

  it("uses the backward placement boundary when dragging upward", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 46 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, b, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 44 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);
  });

  it("updates before and after while the active target remains the same", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 44 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 46 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("changes horizontal side when direction reverses over the same active target", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      axis: "horizontal",
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 16, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 14, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("uses the neutral midpoint boundary before movement direction is known", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 35 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 35 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("uses the rect-targeting position for horizontal sortable placement", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { elements, behaviors } = createHorizontalSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 20 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 120, clientY: 20 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("returns no sortable placement for an isolated self-target drop", () => {
    const { isolated, behaviors } = createMixedGroupSortableList();
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.isolated.onPointerDown(
      createPointerHandlerEvent({ target: isolated }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 65 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("isolated");

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 65 });

    expect(placement).toBeUndefined();
  });

  it("skips different-group sortable items when targeting", () => {
    const { rows, behaviors } = createMixedGroupSortableList();

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: rows.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 55 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
  });

  it("does not move past a skipped-group sibling while the pointer is closer to that sibling", () => {
    const { rows, isolated, behaviors } = createMixedGroupSortableList();
    const { a, c } = rows;
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([
      a,
      isolated,
      c,
    ]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });

    expect(placement).toBeUndefined();
  });

  it("moves past a skipped-group sibling once the pointer is closer to the same-group target", () => {
    const { rows, isolated, behaviors } = createMixedGroupSortableList();
    const { a, c } = rows;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 76 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([
      isolated,
      c,
      a,
    ]);
  });

  it("batches sortable group remeasurement while a group remeasure is pending", () => {
    const { elements, behaviors } = createSortableList();
    const [a] = elements;
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    remeasureSpy.mockClear();

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flushNext();
    expect(raf.pendingCount()).toBe(1);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 65 });
    raf.flushNext();
    expect(raf.pendingCount()).toBe(1);

    raf.flushNext();

    expect(remeasureSpy).toHaveBeenCalledTimes(1);
    expect(remeasureSpy).toHaveBeenCalledWith({ group: "rows" });
  });

  it("cleans sortable dataset state on behavior cleanup", () => {
    const item = createSortableElement("a", createRect({ width: 20, height: 20 }));
    const sortable = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => item,
    });

    sortable.setElement(item);
    expect(item.dataset.dndSortableDraggable).toBe("true");

    sortable.cleanup();

    expect(item.dataset.dndSortableDraggable).toBeUndefined();
    expect(item.dataset.dndDragged).toBeUndefined();
    expect(runtime.getDropTargetRect("a")).toBeNull();
  });

  it("restores prior internal sortable attribute values on behavior cleanup", () => {
    const item = createSortableElement("a", createRect({ width: 20, height: 20 }));
    item.setAttribute("data-dnd-sortable-draggable", "custom-sortable");
    item.setAttribute("data-dnd-dragged", "custom-dragged");
    const sortable = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => item,
    });

    sortable.setElement(item);
    expect(item.getAttribute("data-dnd-sortable-draggable")).toBe("true");

    sortable.cleanup();

    expect(item.getAttribute("data-dnd-sortable-draggable")).toBe("custom-sortable");
    expect(item.getAttribute("data-dnd-dragged")).toBe("custom-dragged");
  });

  it("returns same-container drop placement", () => {
    const { elements, behaviors } = createSortableList("list");
    const [a, b, c] = elements;
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });

    expect(placement).toEqual({
      sourceContainerId: "list",
      containerId: "list",
      previousDraggableId: "b",
      nextDraggableId: "c",
    });
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("restores preview DOM and skips drop when a sortable drop becomes invalid", () => {
    const { elements, behaviors } = createSortableList("list");
    const [a, b, c] = elements;
    const onDrop = vi.fn();
    configureRuntimeCallbacks({ onDrop });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    runtime.unregisterDropTarget("b", b);
    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("restores preview before user drag end rerenders after an invalid drop", () => {
    const { elements, behaviors } = createSortableList("list");
    const [a, b, c] = elements;
    const list = a.parentElement;
    const onDrop = vi.fn();
    const rerenderedElements: HTMLElement[] = [];

    if (!list) {
      throw new Error("Expected sortable list parent");
    }

    runtime.configure({
      targetingAlgorithm: pointerToCenter,
      targetingConstraint: ({ pointerPosition }) => pointerPosition.y < 100,
      hasDragOverlay: false,
      keepOverlayOnDrop: false,
      lifecycleCallbacks: {
        onDragEnd: () => {
          const nextA = createSortableElement(
            "a",
            createRect({ top: 0, width: 20, height: 20 }),
          );
          const nextB = createSortableElement(
            "b",
            createRect({ top: 30, width: 20, height: 20 }),
          );
          const nextC = createSortableElement(
            "c",
            createRect({ top: 60, width: 20, height: 20 }),
          );

          list.replaceChildren(nextA, nextB, nextC);
          createDomSortable({
            runtime,
            draggableId: "a",
            group: "rows",
            containerId: "list",
            getElement: () => nextA,
          }).setElement(nextA);
          createDomSortable({
            runtime,
            draggableId: "b",
            group: "rows",
            containerId: "list",
            getElement: () => nextB,
          }).setElement(nextB);
          createDomSortable({
            runtime,
            draggableId: "c",
            group: "rows",
            containerId: "list",
            getElement: () => nextC,
          }).setElement(nextC);
          rerenderedElements.splice(0, rerenderedElements.length, nextA, nextB, nextC);
        },
        onDrop,
      },
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(list.children)).toEqual([b, a, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 500 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBeNull();

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 500 });

    expect(onDrop).not.toHaveBeenCalled();
    expect(Array.from(list.children)).toEqual(rerenderedElements);
    expect(Array.from(list.children)).not.toContain(a);
    expect(a.dataset.dndDragged).toBeUndefined();
  });

  it("returns cross-container drop placement", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([
      right.b,
      left.a,
      right.c,
    ]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 18 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: "b",
      nextDraggableId: "c",
    });
    expect(Array.from(left.container.children)).toEqual([left.a]);
    expect(Array.from(right.container.children)).toEqual([right.b, right.c]);
  });

  it("prefers item targets over a non-empty container inside the item span", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
      rightContainerRect: createRect({ left: 100, top: 0, width: 50, height: 200 }),
      bRect: createRect({ left: 100, top: 0, width: 50, height: 20 }),
      cRect: createRect({ left: 100, top: 160, width: 50, height: 20 }),
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 95 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(right.container.children)).toEqual([
      right.b,
      left.a,
      right.c,
    ]);
  });

  it("keeps cross-container placement when the pointer moves over the dragged item preview", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b"],
    });
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    stubBoundingClientRect(
      left.a,
      createRect({ left: 100, top: 30, width: 50, height: 20 }),
    );
    runtime.remeasureDropTargets({ group: "cards" });
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 40 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 40 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: "b",
      nextDraggableId: null,
    });
  });

  it("targets a source container after its only item preview moved out", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b"],
    });
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([right.b, left.a]);
    expect(Array.from(left.container.children)).toEqual([]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 25, clientY: 100 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("left");
    expect(Array.from(left.container.children)).toEqual([left.a]);
    expect(Array.from(right.container.children)).toEqual([right.b]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 25, clientY: 100 });

    expect(placement).toBeUndefined();
  });

  it("returns empty-container drop placement", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: [],
    });
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 125, clientY: 100 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([left.a]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 125, clientY: 100 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: null,
      nextDraggableId: null,
    });
    expect(Array.from(left.container.children)).toEqual([left.a]);
    expect(Array.from(right.container.children)).toEqual([]);
  });

  it("returns after-item placement through an item target in a non-empty container", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b"],
    });
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 125, clientY: 160 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([right.b, left.a]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 125, clientY: 160 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: "b",
      nextDraggableId: null,
    });
  });

  it("restores a cross-container preview move on cancel", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([right.b, left.a]);

    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();

    expect(Array.from(left.container.children)).toEqual([left.a]);
    expect(Array.from(right.container.children)).toEqual([right.b]);
    expect(left.a.dataset.dndDragged).toBeUndefined();
  });

  function configureRuntimeCallbacks(
    lifecycleCallbacks: Parameters<DragRuntime["configure"]>[0]["lifecycleCallbacks"],
    options: Partial<
      Pick<
        Parameters<DragRuntime["configure"]>[0],
        "hasDragOverlay" | "targetingAlgorithm"
      >
    > = {},
  ): void {
    runtime.configure({
      targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: options.hasDragOverlay ?? false,
      keepOverlayOnDrop: false,
      lifecycleCallbacks,
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
  }

  function createSortableList(
    containerId?: string,
    options: SortableTestOptions = {},
  ) {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 20 }),
    );
    const b = createSortableElement(
      "b",
      createRect({ top: 30, width: 20, height: 20 }),
    );
    const c = createSortableElement(
      "c",
      createRect({ top: 60, width: 20, height: 20 }),
    );
    list.append(a, b, c);
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      containerId,
      axis: options.axis,
      placementBoundary: options.placementBoundary,
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "rows",
      containerId,
      axis: options.axis,
      placementBoundary: options.placementBoundary,
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "rows",
      containerId,
      axis: options.axis,
      placementBoundary: options.placementBoundary,
      getElement: () => c,
    });

    behaviorA.setElement(a);
    behaviorB.setElement(b);
    behaviorC.setElement(c);

    return {
      elements: [a, b, c] as const,
      behaviors: {
        a: behaviorA,
        b: behaviorB,
        c: behaviorC,
      },
    };
  }

  function createHorizontalSortableList() {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createSortableElement(
      "a",
      createRect({ left: 0, top: 0, width: 100, height: 300 }),
    );
    const b = createSortableElement(
      "b",
      createRect({ left: 120, top: 0, width: 100, height: 300 }),
    );
    const c = createSortableElement(
      "c",
      createRect({ left: 240, top: 0, width: 100, height: 300 }),
    );
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "columns",
      axis: "horizontal",
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "columns",
      axis: "horizontal",
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "columns",
      axis: "horizontal",
      getElement: () => c,
    });

    list.append(a, b, c);
    behaviorA.setElement(a);
    behaviorB.setElement(b);
    behaviorC.setElement(c);

    return {
      elements: [a, b, c] as const,
      behaviors: {
        a: behaviorA,
        b: behaviorB,
        c: behaviorC,
      },
    };
  }

  function createTallSortableList() {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 100 }),
    );
    const b = createSortableElement(
      "b",
      createRect({ top: 120, width: 20, height: 400 }),
    );
    list.append(a, b);
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "rows",
      getElement: () => b,
    });

    behaviorA.setElement(a);
    behaviorB.setElement(b);

    return {
      elements: [a, b] as const,
      behaviors: {
        a: behaviorA,
        b: behaviorB,
      },
    };
  }

  function createFourItemSortableList() {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 20 }),
    );
    const b = createSortableElement(
      "b",
      createRect({ top: 30, width: 20, height: 20 }),
    );
    const c = createSortableElement(
      "c",
      createRect({ top: 60, width: 20, height: 20 }),
    );
    const d = createSortableElement(
      "d",
      createRect({ top: 90, width: 20, height: 20 }),
    );
    list.append(a, b, c, d);
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "rows",
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "rows",
      getElement: () => c,
    });
    const behaviorD = createDomSortable({
      runtime,
      draggableId: "d",
      group: "rows",
      getElement: () => d,
    });

    behaviorA.setElement(a);
    behaviorB.setElement(b);
    behaviorC.setElement(c);
    behaviorD.setElement(d);

    return {
      elements: [a, b, c, d] as const,
      behaviors: {
        a: behaviorA,
        b: behaviorB,
        c: behaviorC,
        d: behaviorD,
      },
    };
  }

  function createMixedGroupSortableList() {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 20 }),
    );
    const isolated = createSortableElement(
      "isolated",
      createRect({ top: 30, width: 20, height: 20 }),
    );
    const c = createSortableElement(
      "c",
      createRect({ top: 60, width: 20, height: 20 }),
    );
    list.append(a, isolated, c);
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      getElement: () => a,
    });
    const behaviorIsolated = createDomSortable({
      runtime,
      draggableId: "isolated",
      group: "isolated-rows",
      getElement: () => isolated,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "rows",
      getElement: () => c,
    });

    behaviorA.setElement(a);
    behaviorIsolated.setElement(isolated);
    behaviorC.setElement(c);

    return {
      rows: {
        a,
        c,
      },
      isolated,
      behaviors: {
        a: behaviorA,
        isolated: behaviorIsolated,
        c: behaviorC,
      },
    };
  }

  function createSortableBoard(input: {
    rightItems: ("b" | "c")[];
    rightContainerRect?: ReturnType<typeof createRect>;
    bRect?: ReturnType<typeof createRect>;
    cRect?: ReturnType<typeof createRect>;
  }) {
    const leftContainer = createContainer(
      "left",
      createRect({ left: 0, top: 0, width: 50, height: 200 }),
    );
    const rightContainer = createContainer(
      "right",
      input.rightContainerRect ??
        createRect({ left: 100, top: 0, width: 50, height: 200 }),
    );
    const a = createSortableElement(
      "a",
      createRect({ left: 0, top: 0, width: 50, height: 20 }),
    );
    const b = createSortableElement(
      "b",
      input.bRect ?? createRect({ left: 100, top: 0, width: 50, height: 20 }),
    );
    const c = createSortableElement(
      "c",
      input.cRect ?? createRect({ left: 100, top: 30, width: 50, height: 20 }),
    );
    const containerLeftBehavior = createDomDropContainer({
      runtime,
      containerId: "left",
      group: "cards",
      getElement: () => leftContainer,
    });
    const containerRightBehavior = createDomDropContainer({
      runtime,
      containerId: "right",
      group: "cards",
      getElement: () => rightContainer,
    });
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "cards",
      containerId: "left",
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "cards",
      containerId: "right",
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "cards",
      containerId: "right",
      getElement: () => c,
    });

    leftContainer.append(a);
    rightContainer.append(
      ...input.rightItems.map((draggableId) => (draggableId === "b" ? b : c)),
    );
    containerLeftBehavior.setElement(leftContainer);
    containerRightBehavior.setElement(rightContainer);
    behaviorA.setElement(a);

    if (input.rightItems.includes("b")) {
      behaviorB.setElement(b);
    }

    if (input.rightItems.includes("c")) {
      behaviorC.setElement(c);
    }

    return {
      left: {
        container: leftContainer,
        a,
      },
      right: {
        container: rightContainer,
        b,
        c,
      },
      behaviors: {
        a: behaviorA,
        b: behaviorB,
        c: behaviorC,
      },
    };
  }
});

function createSortableElement(draggableId: string, rect: ReturnType<typeof createRect>) {
  const element = document.createElement("div");
  element.dataset.draggableId = draggableId;
  document.body.append(element);
  stubBoundingClientRect(element, rect);
  return element;
}

function createContainer(
  containerId: string,
  rect: ReturnType<typeof createRect>,
): HTMLElement {
  const element = document.createElement("div");
  element.dataset.containerId = containerId;
  stubBoundingClientRect(element, rect);
  document.body.append(element);
  return element;
}
