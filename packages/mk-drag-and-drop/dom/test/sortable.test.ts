import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  centerToCenter,
  maxOverlayCenterDistanceToRect,
  pointerToCenter,
  restrictToContainer,
  type SortableAxis,
  type SortableDropPlacement,
  type TargetingAlgorithm,
} from "../src/index.js";
import {
  createDomDropContainer,
  createDomSortable,
} from "../src/integration/index.js";
import {
  createDragRuntime,
  type DragRuntime,
} from "../src/runtime/drag-runtime.js";
import { getSortablePreviewPlacement } from "../src/sortable/sortable-preview.js";
import {
  createPointerHandlerEvent,
  createRect,
  dispatchKeyDown,
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
      overlayRelease: "auto",
      lifecycleCallbacks: {},
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
  });

  afterEach(() => {
    runtime.releaseActiveDragResources();
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
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    remeasureSpy.mockClear();
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(a.dataset.dndDragged).toBe("true");

    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expect(a.dataset.dndSortableDraggable).toBe("true");
    expect(remeasureSpy).not.toHaveBeenCalled();
  });

  it("keeps sortable registrations after drop, cancel, and direct active cleanup", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });
    expectSortableRegistrations(["a", "b", "c"]);

    behaviors.b.onPointerDown(createPointerHandlerEvent({ target: b }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 75 });
    raf.flush();
    runtime.cancelDrag();
    expectSortableRegistrations(["a", "b", "c"]);

    behaviors.c.onPointerDown(createPointerHandlerEvent({ target: c }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 15 });
    raf.flush();
    runtime.releaseActiveDragResources();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable active state on keyboard cancel", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onKeyDown(createKeyboardHandlerEvent({ target: a, key: "Space" }));
    dispatchKeyDown(window, "ArrowDown");

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchKeyDown(window, "Escape");

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable active state on no-target release", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    runtime.endDrag();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable preview on invalid-target release", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    b.remove();
    runtime.endDrag();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expect(runtime.getDropTargetRegistration("a", "rows")).not.toBeNull();
  });

  it("restores sortable active state when onDragStart throws", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const error = new Error("drag start failed");
    configureRuntimeCallbacks({
      onDragStart: () => {
        throw error;
      },
    });

    expect(() => {
      behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    }).toThrow(error);

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable preview when onDragUpdate throws after preview movement", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const error = new Error("drag update failed");
    configureRuntimeCallbacks({
      onDragUpdate: () => {
        throw error;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });

    expect(() => {
      raf.flush();
    }).toThrow(error);

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable preview when onDragEnd throws", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const error = new Error("drag end failed");
    configureRuntimeCallbacks({
      onDragEnd: () => {
        throw error;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(() => {
      runtime.endDrag();
    }).toThrow(error);

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable preview when onDrop throws", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const error = new Error("drop failed");
    configureRuntimeCallbacks({
      onDrop: () => {
        throw error;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(() => {
      runtime.endDrag();
    }).toThrow(error);

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
  });

  it("restores sortable active state when overlay creation throws", () => {
    const error = new Error("overlay mount failed");
    runtime = createDragRuntime({
      updateOverlayHost: (update) => {
        if (update.type === "mount") {
          throw error;
        }
      },
    });
    configureRuntimeCallbacks(
      {},
      {
        hasDragOverlay: true,
      },
    );
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    expect(() => {
      behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    }).toThrow(error);

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
    expect(a.dataset.dndDragged).toBeUndefined();
    expectSortableRegistrations(["a", "b", "c"]);
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

  it("returns the release-time drop target rect after sortable cleanup", () => {
    const list = document.createElement("div");
    document.body.append(list);
    let releaseTargetRect: ReturnType<typeof createRect> | null = null;
    let bRect = createRect({ top: 30, width: 20, height: 20 });
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 20 }),
    );
    const b = createMutableSortableElement("b", () => bRect);
    const c = createSortableElement(
      "c",
      createRect({ top: 60, width: 20, height: 20 }),
    );
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

    list.append(a, b, c);
    behaviorA.setElement(a);
    behaviorB.setElement(b);
    behaviorC.setElement(c);
    runtime.subscribe({
      onDragEnd: () => {
        bRect = createRect({ top: 30, width: 20, height: 20 });
      },
    });
    configureRuntimeCallbacks({
      onDragEnd: ({ dropTargetId }, { getDropTargetRect }) => {
        releaseTargetRect = dropTargetId
          ? getDropTargetRect(dropTargetId)
          : null;
      },
    });

    behaviorA.onPointerDown(createPointerHandlerEvent({ target: a }));
    bRect = createRect({ top: 0, width: 20, height: 20 });
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 36 });
    raf.flushNext();

    expect(Array.from(list.children)).toEqual([b, a, c]);
    expect(raf.pendingCount()).toBe(0);
    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 36 });

    expect(releaseTargetRect).toEqual(
      createRect({ top: 0, width: 20, height: 20 }),
    );
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

  it("places after immediately when moving forward into a newly active target", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("places after immediately on horizontal forward entry", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      axis: "horizontal",
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 4, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("does not use placementBoundary.start as the primary forward placement switch", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { start: 0.9 },
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("does not use placementBoundary.end as the primary backward placement switch", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { end: 0.1 },
    });
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 46 });
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
      secondB,
      secondA,
      secondC,
    ]);
  });

  it("keeps after placement on upward reversal until the end boundary is crossed", () => {
    const { elements, behaviors } = createTallSortableList();
    const [a, b] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 500 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 430 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 419 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b]);
  });

  it("keeps before placement on downward reversal until the start boundary is crossed", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { start: 0.5 },
    });
    const [a, b, c] = elements;

    behaviors.c.onPointerDown(
      createPointerHandlerEvent({ target: c, clientX: 10, clientY: 70 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 39 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 39.5 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, c, b]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40.5 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(c.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("switches from before to after once the start boundary is crossed on the same active target", () => {
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

  it("uses horizontal reversal thresholds over the same active target", () => {
    const { elements, behaviors } = createSortableList(undefined, {
      axis: "horizontal",
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 16, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 15.5, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 14.5, clientY: 40 });
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

  it("keeps center-to-center target selection overlay-center based regardless of placement boundaries", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { elements, behaviors } = createSortableList(undefined, {
      placementBoundary: { start: 1 },
    });
    const [a, b, c] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 0 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 25 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
  });

  it("uses explicit overlay-center targeting constraints", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        targetingConstraint: maxOverlayCenterDistanceToRect({ maxDistance: 4 }),
        hasDragOverlay: true,
      },
    );
    const { elements, behaviors } = createSortableList();
    const [a] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 0 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 25 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
  });

  it("keeps center-to-center sortable reversal coherent after preview DOM movement", () => {
    let placement: SortableDropPlacement | undefined;

    configureRuntimeCallbacks(
      {
        onDrop: ({ sortablePlacement }) => {
          placement = sortablePlacement;
        },
      },
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { list, elements, behaviors } = createDynamicFourItemSortableList(
      "list",
    );
    const [a, b, c, d] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 10 }),
    );

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 75 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(list.children)).toEqual([b, c, a, d]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(list.children)).toEqual([b, a, c, d]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(list.children)).toEqual([a, b, c, d]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(placement).toBeUndefined();
    expect(Array.from(list.children)).toEqual([a, b, c, d]);
  });

  it("keeps sortable preview state when center-to-center selects the dragged item", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { list, elements, behaviors } = createDynamicFourItemSortableList();
    const [a, b, c, d] = elements;

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 75 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(list.children)).toEqual([b, c, a, d]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 70 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("a");
    expect(Array.from(list.children)).toEqual([b, c, a, d]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(list.children)).toEqual([b, a, c, d]);
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

  it("moves against the active same-group target without treating skipped siblings as blockers", () => {
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
      isolated,
      c,
      a,
    ]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });

    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "c",
      nextDraggableId: null,
      targetDraggableId: "c",
      side: "after",
    });
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

  it("commits item five before item four without crossing an isolated sibling", () => {
    const { list, rows, isolated, behaviors } = createMixedFiveGroupSortableList();
    let items = ["one", "two", "isolated-three", "four", "five"];
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ draggableId, sortablePlacement }) => {
        placement = sortablePlacement;

        if (sortablePlacement) {
          items = reorderDataWithSortablePlacement(
            items,
            draggableId,
            sortablePlacement,
          );
        }
      },
    });

    behaviors.five.onPointerDown(
      createPointerHandlerEvent({ target: rows.five, clientX: 10, clientY: 130 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 95 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("four");
    expect(Array.from(list.children)).toEqual([
      rows.one,
      rows.two,
      isolated,
      rows.five,
      rows.four,
    ]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 95 });

    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "two",
      nextDraggableId: "four",
      targetDraggableId: "four",
      side: "before",
    });
    expect(items).toEqual(["one", "two", "isolated-three", "five", "four"]);
  });

  it("commits item one after an isolated sibling by anchoring before item four", () => {
    const { list, rows, isolated, behaviors } = createMixedFiveGroupSortableList();
    let items = ["one", "two", "isolated-three", "four", "five"];
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ draggableId, sortablePlacement }) => {
        placement = sortablePlacement;

        if (sortablePlacement) {
          items = reorderDataWithSortablePlacement(
            items,
            draggableId,
            sortablePlacement,
          );
        }
      },
    });

    behaviors.one.onPointerDown(
      createPointerHandlerEvent({ target: rows.one, clientX: 10, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 115 });
    raf.flush();
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 65 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("four");
    expect(Array.from(list.children)).toEqual([
      rows.two,
      isolated,
      rows.one,
      rows.four,
      rows.five,
    ]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 66 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("one");
    expect(Array.from(list.children)).toEqual([
      rows.two,
      isolated,
      rows.one,
      rows.four,
      rows.five,
    ]);

    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 66 });

    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "two",
      nextDraggableId: "four",
      targetDraggableId: "four",
      side: "before",
    });
    expect(items).toEqual(["two", "isolated-three", "one", "four", "five"]);
  });

  it("keeps distinct target anchors for visual placements in the same same-group interval", () => {
    const { rows, behaviors } = createMixedFiveGroupSortableList();
    const placements: SortableDropPlacement[] = [];
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        if (sortablePlacement) {
          placements.push(sortablePlacement);
        }
      },
    });

    behaviors.one.onPointerDown(
      createPointerHandlerEvent({ target: rows.one, clientX: 10, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });

    behaviors.one.onPointerDown(
      createPointerHandlerEvent({ target: rows.one, clientX: 10, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 115 });
    raf.flush();
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 65 });
    raf.flush();
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 66 });
    raf.flush();
    dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 66 });

    expect(placements).toHaveLength(2);
    expect(placements[0]).toMatchObject({
      previousDraggableId: "two",
      nextDraggableId: "four",
      targetDraggableId: "two",
      side: "after",
    });
    expect(placements[1]).toMatchObject({
      previousDraggableId: "two",
      nextDraggableId: "four",
      targetDraggableId: "four",
      side: "before",
    });
  });

  it("uses exact target anchors before same-group sibling anchors when reordering app data", () => {
    const items = ["1", "2", "3", "4", "5"];

    expect(
      reorderDataWithSortablePlacement(items, "1", {
        sourceContainerId: null,
        containerId: null,
        previousDraggableId: "2",
        nextDraggableId: "4",
        targetDraggableId: "4",
        side: "before",
      }),
    ).toEqual(["2", "3", "1", "4", "5"]);

    expect(
      reorderDataWithSortablePlacement(items, "1", {
        sourceContainerId: null,
        containerId: null,
        previousDraggableId: "2",
        nextDraggableId: "4",
        targetDraggableId: "2",
        side: "after",
      }),
    ).toEqual(["2", "1", "3", "4", "5"]);
  });

  it("moves sortable preview without auto-remeasuring the group", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    remeasureSpy.mockClear();

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(remeasureSpy).not.toHaveBeenCalled();
    expect(raf.pendingCount()).toBe(0);
  });

  it("does not schedule full group remeasurement for repeated preview movement", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    remeasureSpy.mockClear();

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    expect(raf.pendingCount()).toBe(0);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 75 });
    raf.flush();
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, c, a]);
    expect(raf.pendingCount()).toBe(0);

    expect(remeasureSpy).not.toHaveBeenCalled();
  });

  it("runs sortable drag update subscriptions when recomputing an active drag", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const bMeasure = vi.mocked(b.getBoundingClientRect);
    const onDragUpdate = vi.fn();
    runtime.subscribe({ onDragUpdate });

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: a, clientX: 10, clientY: 35 }),
    );
    bMeasure.mockClear();

    runtime.recomputeActiveDrag();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(onDragUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDropTargetId: "b",
        previousDropTargetId: null,
        pointerPosition: { x: 10, y: 35 },
        placementPosition: { x: 10, y: 35 },
      }),
    );
    expect(bMeasure).toHaveBeenCalled();
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);
  });

  it("updates sortable preview when window scroll changes the active target on recompute", () => {
    const scrollOffset = mockWindowScrollOffset();
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;

    try {
      behaviors.a.onPointerDown(
        createPointerHandlerEvent({ target: a, clientX: 10, clientY: 35 }),
      );

      runtime.recomputeActiveDrag();
      expect(runtime.activeDropTargetId).toBe("b");
      expect(Array.from(a.parentElement?.children ?? [])).toEqual([a, b, c]);

      scrollOffset.set({ y: 30 });
      runtime.recomputeActiveDrag();

      expect(runtime.activeDropTargetId).toBe("c");
      expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);
    } finally {
      scrollOffset.restore();
    }
  });

  it("does not invoke global sortable remeasurement during recompute", () => {
    const { elements, behaviors } = createSortableList();
    const [a] = elements;
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    remeasureSpy.mockClear();

    runtime.recomputeActiveDrag();

    expect(remeasureSpy).not.toHaveBeenCalled();
  });

  it("requires explicit remeasure before recompute reflects stale sortable measurements", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const bMeasure = vi.mocked(b.getBoundingClientRect);
    const cMeasure = vi.mocked(c.getBoundingClientRect);

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();
    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    bMeasure.mockReturnValue(
      createRect({ top: 200, width: 20, height: 20 }) as DOMRect,
    );
    cMeasure.mockReturnValue(
      createRect({ top: 30, width: 20, height: 20 }) as DOMRect,
    );
    bMeasure.mockClear();
    cMeasure.mockClear();

    runtime.recomputeActiveDrag();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, a, c]);

    runtime.remeasureDropTargets({ group: "rows" });
    expect(bMeasure).toHaveBeenCalled();
    expect(cMeasure).toHaveBeenCalled();

    bMeasure.mockClear();
    cMeasure.mockClear();
    runtime.recomputeActiveDrag();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([b, c, a]);
  });

  it("keeps manual runtime drop-target remeasurement explicit", () => {
    const a = createSortableElement(
      "a",
      createRect({ top: 0, width: 20, height: 20 }),
    );
    const b = createSortableElement(
      "b",
      createRect({ top: 30, width: 20, height: 20 }),
    );
    const x = createSortableElement(
      "x",
      createRect({ top: 60, width: 20, height: 20 }),
    );
    const aMeasure = vi.mocked(a.getBoundingClientRect);
    const bMeasure = vi.mocked(b.getBoundingClientRect);
    const xMeasure = vi.mocked(x.getBoundingClientRect);
    const clearMeasures = (): void => {
      aMeasure.mockClear();
      bMeasure.mockClear();
      xMeasure.mockClear();
    };

    runtime.registerDropTarget("a", a, "rows");
    runtime.registerDropTarget("b", b, "rows");
    runtime.registerDropTarget("x", x, "columns");

    clearMeasures();
    runtime.remeasureDropTargets("a");
    expect(aMeasure).toHaveBeenCalledTimes(1);
    expect(bMeasure).not.toHaveBeenCalled();
    expect(xMeasure).not.toHaveBeenCalled();

    clearMeasures();
    runtime.remeasureDropTargets(["a", "b"]);
    expect(aMeasure).toHaveBeenCalledTimes(1);
    expect(bMeasure).toHaveBeenCalledTimes(1);
    expect(xMeasure).not.toHaveBeenCalled();

    clearMeasures();
    runtime.remeasureDropTargets({ group: "rows" });
    expect(aMeasure).toHaveBeenCalledTimes(1);
    expect(bMeasure).toHaveBeenCalledTimes(1);
    expect(xMeasure).not.toHaveBeenCalled();

    clearMeasures();
    runtime.remeasureDropTargets();
    expect(aMeasure).toHaveBeenCalledTimes(1);
    expect(bMeasure).toHaveBeenCalledTimes(1);
    expect(xMeasure).toHaveBeenCalledTimes(1);
  });

  it("does not measure every sortable item after one preview move", () => {
    const itemCount = 100;
    const list = document.createElement("div");
    document.body.append(list);
    const elements = Array.from({ length: itemCount }, (_, index) =>
      createSortableElement(
        `item-${index}`,
        createRect({ top: index * 30, width: 20, height: 20 }),
      ),
    );
    const behaviors = elements.map((element, index) =>
      createDomSortable({
        runtime,
        draggableId: `item-${index}`,
        group: "rows",
        getElement: () => element,
      }),
    );
    const rectSpies = elements.map((element) =>
      vi.mocked(element.getBoundingClientRect),
    );
    const draggedElement = elements[0];
    const secondElement = elements[1];
    const draggedBehavior = behaviors[0];

    if (!draggedElement || !secondElement || !draggedBehavior) {
      throw new Error("Expected sortable list items");
    }

    list.append(...elements);
    behaviors.forEach((behavior, index) => {
      const element = elements[index];

      if (!element) {
        throw new Error("Expected sortable list item");
      }

      behavior.setElement(element);
    });

    draggedBehavior.onPointerDown(
      createPointerHandlerEvent({ target: draggedElement }),
    );
    rectSpies.forEach((rectSpy) => {
      rectSpy.mockClear();
    });

    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(list.children).slice(0, 2)).toEqual([
      secondElement,
      draggedElement,
    ]);
    expect(
      rectSpies.filter((rectSpy) => rectSpy.mock.calls.length > 0).length,
    ).toBeLessThan(itemCount);
  });

  it("does not enumerate sortable children on repeated already-placed preview frames", () => {
    const { list, elements, sourceBehavior } = createLargeSortablePreviewList({
      itemCount: 10_000,
    });
    const draggedElement = elements[0];
    const secondElement = elements[1];

    if (!draggedElement || !secondElement) {
      throw new Error("Expected sortable list items");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: draggedElement }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(Array.from(list.children).slice(0, 2)).toEqual([
      secondElement,
      draggedElement,
    ]);

    const collectionItemSpy = vi.spyOn(HTMLCollection.prototype, "item");

    try {
      dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
      raf.flush();

      expect(collectionItemSpy).not.toHaveBeenCalled();
    } finally {
      collectionItemSpy.mockRestore();
    }

    expect(Array.from(list.children).slice(0, 2)).toEqual([
      secondElement,
      draggedElement,
    ]);
    expect(raf.pendingCount()).toBe(0);
  });

  it("ignores a stale sortable target element that is no longer registry-owned", () => {
    const { elements, behaviors } = createSortableList();
    const [a, b, c] = elements;
    const replacementB = createUnattachedSortableElement(
      "replacement-b",
      createRect({ top: 30, width: 20, height: 20 }),
    );

    b.after(replacementB);
    runtime.registerDropTarget("b", replacementB, "rows", {
      sortable: true,
      sortableAxis: "vertical",
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(a.parentElement?.children ?? [])).toEqual([
      a,
      b,
      replacementB,
      c,
    ]);
  });

  it("narrows large vertical sortable candidates before built-in targeting", () => {
    const candidateIds: string[] = [];
    configureRuntimeCallbacks(
      {},
      {
        targetingConstraint: ({ dropTarget }) => {
          candidateIds.push(dropTarget.dropTargetId);
          return true;
        },
      },
    );
    const { elements, sourceBehavior } = createLargeSortableTargetList({
      itemCount: 10_000,
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected source element");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: sourceElement }),
    );
    candidateIds.splice(0, candidateIds.length);

    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 10,
      clientY: 5_000 * 30 + 10,
    });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("item-5000");
    expect(candidateIds).toContain("item-5000");
    expect(candidateIds.length).toBeLessThan(20);
  });

  it("uses y-axis sortable narrowing for vertical lists", () => {
    const candidateIds: string[] = [];
    configureRuntimeCallbacks(
      {},
      {
        targetingConstraint: ({ dropTarget }) => {
          candidateIds.push(dropTarget.dropTargetId);
          return true;
        },
      },
    );
    const { elements, sourceBehavior } = createLargeSortableTargetList({
      itemCount: 200,
      axis: "vertical",
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected source element");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: sourceElement }),
    );
    candidateIds.splice(0, candidateIds.length);

    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 10,
      clientY: 120 * 30 + 10,
    });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("item-120");
    expect(candidateIds).toContain("item-120");
    expect(candidateIds.length).toBeLessThan(20);
  });

  it("uses x-axis sortable narrowing for horizontal lists", () => {
    const candidateIds: string[] = [];
    configureRuntimeCallbacks(
      {},
      {
        targetingConstraint: ({ dropTarget }) => {
          candidateIds.push(dropTarget.dropTargetId);
          return true;
        },
      },
    );
    const { elements, sourceBehavior } = createLargeSortableTargetList({
      itemCount: 200,
      axis: "horizontal",
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected source element");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: sourceElement }),
    );
    candidateIds.splice(0, candidateIds.length);

    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 120 * 30 + 10,
      clientY: 10,
    });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("item-120");
    expect(candidateIds).toContain("item-120");
    expect(candidateIds.length).toBeLessThan(20);
  });

  it("keeps custom targeting algorithms on the full candidate scan", () => {
    let candidateIds: string[] = [];
    const targetingAlgorithm: TargetingAlgorithm = Object.assign(
      ({ dropTargets }) => {
        candidateIds = dropTargets.map((dropTarget) => dropTarget.dropTargetId);

        return dropTargets.at(-1) ?? null;
      },
      { mode: "pointer" as const },
    );
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm,
      },
    );
    const { elements, sourceBehavior } = createLargeSortableTargetList({
      itemCount: 50,
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected source element");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: sourceElement }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 10 });
    raf.flush();

    expect(candidateIds).toHaveLength(50);
    expect(runtime.activeDropTargetId).toBe("item-49");
  });

  it("falls back to the full scan when constraints reject narrowed candidates", () => {
    const candidateIds: string[] = [];
    configureRuntimeCallbacks(
      {},
      {
        targetingConstraint: ({ dropTarget }) => {
          candidateIds.push(dropTarget.dropTargetId);
          return dropTarget.dropTargetId === "item-70";
        },
      },
    );
    const { elements, sourceBehavior } = createLargeSortableTargetList({
      itemCount: 100,
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected source element");
    }

    sourceBehavior.onPointerDown(
      createPointerHandlerEvent({ target: sourceElement }),
    );
    candidateIds.splice(0, candidateIds.length);

    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 10,
      clientY: 20 * 30 + 10,
    });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("item-70");
    expect(candidateIds).toContain("item-70");
    expect(candidateIds.length).toBeGreaterThan(20);
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

    sortable.releaseRegistration();

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

    sortable.releaseRegistration();

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
      targetDraggableId: "b",
      side: "after",
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
      overlayRelease: "auto",
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

  it("places a kanban-like card before the first destination card from the target top half", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);
  });

  it("places a kanban-like card before the first destination card with center-to-center overlay", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: left.a, clientX: 25, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);
  });

  it("uses placementBoundary on the first same-target move after midpoint entry", () => {
    configureRuntimeCallbacks(
      {},
      {
        targetingAlgorithm: centerToCenter,
        hasDragOverlay: true,
      },
    );
    const { left, right, behaviors } = createSortableBoard({
      placementBoundary: { start: 1 },
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: left.a, clientX: 25, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 12 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);
  });

  it("keeps midpoint entry placement on same-position recompute", () => {
    const list = document.createElement("div");
    const target = document.createElement("div");

    list.append(target);
    document.body.append(list);
    stubBoundingClientRect(
      target,
      createRect({ top: 0, width: 20, height: 20 }),
    );

    const placementDecision = getSortablePreviewPlacement({
      activeDropTargetId: "b",
      targetElement: target,
      placementPosition: { x: 10, y: 80 },
      movement: { previousPointerPosition: { x: 10, y: 80 } },
      previewPlacement: {
        activeDropTargetId: "b",
        placement: "before",
        movementDirection: "none",
        containerElement: list,
        pendingMidpointInitialPlacement: false,
      },
      options: {
        axis: "vertical",
        placementBoundary: { start: 0.25, end: 0.75 },
      },
    });

    expect(placementDecision).toEqual({
      placement: "before",
      movementDirection: "none",
    });
  });

  it("keeps midpoint entry placement when only modifier-adjusted placement shifts", () => {
    const list = document.createElement("div");
    const target = document.createElement("div");

    list.append(target);
    document.body.append(list);
    stubBoundingClientRect(
      target,
      createRect({ top: 0, width: 20, height: 20 }),
    );

    const placementDecision = getSortablePreviewPlacement({
      activeDropTargetId: "b",
      targetElement: target,
      placementPosition: { x: 10, y: 12 },
      movementPosition: { x: 10, y: 80 },
      movement: {
        previousPointerPosition: { x: 10, y: 80 },
        previousPlacementPosition: { x: 10, y: 4 },
      },
      previewPlacement: {
        activeDropTargetId: "b",
        placement: "before",
        movementDirection: "none",
        containerElement: list,
        pendingMidpointInitialPlacement: false,
      },
      options: {
        axis: "vertical",
        placementBoundary: { start: 0.25, end: 0.75 },
      },
    });

    expect(placementDecision).toEqual({
      placement: "before",
      movementDirection: "none",
    });
  });

  it("keeps midpoint entry placement when container bounds grow without raw pointer movement", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });
    const boundsElement = document.createElement("div");

    document.body.append(boundsElement);
    vi.spyOn(boundsElement, "getBoundingClientRect").mockImplementation(() =>
      createRect({
        left: 0,
        top: -10,
        width: 200,
        height: right.container.children.length > 2 ? 32 : 24,
      }) as DOMRect,
    );
    runtime.configure({
      targetingAlgorithm: pointerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: false,
      overlayRelease: "auto",
      lifecycleCallbacks: {},
      keyboardConfiguration: undefined,
      modifiers: [restrictToContainer(() => boundsElement)],
      pointerConfiguration: undefined,
    });

    behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: left.a, clientX: 25, clientY: 10 }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 20 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);

    runtime.recomputeActiveDrag();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);
  });

  it("uses same-container placement after entering a destination list", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 34 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("c");
    expect(Array.from(right.container.children)).toEqual([
      right.b,
      right.c,
      left.a,
    ]);
  });

  it("remeasures shifted sortable items after cross-container preview movement", () => {
    let leftContainer: HTMLElement;
    let rightContainer: HTMLElement;
    const createBoardContainer = (
      containerId: string,
      left: number,
    ): HTMLElement => {
      const container = document.createElement("div");
      container.dataset.containerId = containerId;
      vi.spyOn(container, "getBoundingClientRect").mockImplementation(
        () =>
          createRect({
            left,
            top: 0,
            width: 50,
            height: Math.max(20, container.children.length * 30 - 10),
          }) as DOMRect,
      );
      document.body.append(container);
      return container;
    };
    const createCard = (draggableId: string): HTMLElement => {
      const element = document.createElement("div");
      element.dataset.draggableId = draggableId;
      vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => {
        const parent = element.parentElement;
        const childIndex = parent
          ? (Array.prototype.indexOf.call(parent.children, element) as number)
          : 0;
        const index = childIndex < 0 ? 0 : childIndex;
        const left = parent === rightContainer ? 100 : 0;

        return createRect({
          left,
          top: index * 30,
          width: 50,
          height: 20,
        }) as DOMRect;
      });
      return element;
    };
    const registerCard = (
      draggableId: string,
      element: HTMLElement,
      containerId: string,
    ) => {
      const behavior = createDomSortable({
        runtime,
        draggableId,
        group: "cards",
        containerId,
        getElement: () => element,
      });

      behavior.setElement(element);
      return behavior;
    };

    leftContainer = createBoardContainer("left", 0);
    rightContainer = createBoardContainer("right", 100);
    const a = createCard("a");
    const x = createCard("x");
    const y = createCard("y");
    const b = createCard("b");
    const c = createCard("c");
    const d = createCard("d");
    const leftContainerBehavior = createDomDropContainer({
      runtime,
      containerId: "left",
      group: "cards",
      getElement: () => leftContainer,
    });
    const rightContainerBehavior = createDomDropContainer({
      runtime,
      containerId: "right",
      group: "cards",
      getElement: () => rightContainer,
    });

    leftContainer.append(a, x, y);
    rightContainer.append(b, c, d);
    leftContainerBehavior.setElement(leftContainer);
    rightContainerBehavior.setElement(rightContainer);
    const behaviorA = registerCard("a", a, "left");
    registerCard("x", x, "left");
    registerCard("y", y, "left");
    registerCard("b", b, "right");
    registerCard("c", c, "right");
    registerCard("d", d, "right");

    behaviorA.onPointerDown(createPointerHandlerEvent({ target: a }));
    vi.mocked(y.getBoundingClientRect).mockClear();
    vi.mocked(d.getBoundingClientRect).mockClear();

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(rightContainer.children)).toEqual([a, b, c, d]);
    expect(runtime.getDropTargetRect("y")?.top).toBe(30);
    expect(runtime.getDropTargetRect("d")?.top).toBe(90);
    expect(y.getBoundingClientRect).toHaveBeenCalled();
    expect(d.getBoundingClientRect).toHaveBeenCalled();
  });

  it("uses midpoint placement for the first item target after a container preview move", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: [],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 125, clientY: 1 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("right");
    expect(Array.from(right.container.children)).toEqual([left.a]);

    right.container.append(right.b);
    behaviors.b.setElement(right.b);
    runtime.remeasureDropTargets({ group: "cards" });

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([left.a, right.b]);
  });

  it("keeps midpoint placement for the first item target after a container preview recompute", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: [],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 125, clientY: 1 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("right");
    expect(Array.from(right.container.children)).toEqual([left.a]);

    runtime.recomputeActiveDrag();

    right.container.append(right.b);
    behaviors.b.setElement(right.b);
    runtime.remeasureDropTargets({ group: "cards" });

    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([left.a, right.b]);
  });

  it("places a cross-container vertical target after from the target bottom half", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      right.b,
      left.a,
      right.c,
    ]);
  });

  it("places a cross-container horizontal target before from the target left half", () => {
    const { left, right, behaviors } = createSortableBoard({
      axis: "horizontal",
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      left.a,
      right.b,
      right.c,
    ]);
  });

  it("places a cross-container horizontal target after from the target right half", () => {
    const { left, right, behaviors } = createSortableBoard({
      axis: "horizontal",
      rightItems: ["b", "c"],
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    dispatchPointerMove(window, { pointerId: 1, clientX: 140, clientY: 10 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(right.container.children)).toEqual([
      right.b,
      left.a,
      right.c,
    ]);
  });

  it("does not use placementBoundary for cross-container initial midpoint placement", () => {
    const topEntry = createSortableBoard({
      placementBoundary: { start: 0, end: 0 },
      rightItems: ["b", "c"],
    });

    topEntry.behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: topEntry.left.a }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 4 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(topEntry.right.container.children)).toEqual([
      topEntry.left.a,
      topEntry.right.b,
      topEntry.right.c,
    ]);

    dispatchPointerCancel(window, { pointerId: 1 });
    raf.flush();

    const bottomEntry = createSortableBoard({
      placementBoundary: { start: 1, end: 1 },
      rightItems: ["b", "c"],
    });

    bottomEntry.behaviors.a.onPointerDown(
      createPointerHandlerEvent({ target: bottomEntry.left.a }),
    );
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(runtime.activeDropTargetId).toBe("b");
    expect(Array.from(bottomEntry.right.container.children)).toEqual([
      bottomEntry.right.b,
      bottomEntry.left.a,
      bottomEntry.right.c,
    ]);
  });

  it("returns cross-container drop placement", () => {
    const { left, right, behaviors } = createSortableBoard({
      rightItems: ["b", "c"],
    });
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    remeasureSpy.mockClear();
    dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([
      right.b,
      left.a,
      right.c,
    ]);
    expect(remeasureSpy).not.toHaveBeenCalled();

    dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 18 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: "b",
      nextDraggableId: "c",
      targetDraggableId: "b",
      side: "after",
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
      targetDraggableId: "b",
      side: "after",
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
    const remeasureSpy = vi.spyOn(runtime, "remeasureDropTargets");
    let placement: SortableDropPlacement | undefined;
    configureRuntimeCallbacks({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement;
      },
    });

    behaviors.a.onPointerDown(createPointerHandlerEvent({ target: left.a }));
    remeasureSpy.mockClear();
    dispatchPointerMove(window, { pointerId: 1, clientX: 125, clientY: 100 });
    raf.flush();

    expect(Array.from(right.container.children)).toEqual([left.a]);
    expect(remeasureSpy).not.toHaveBeenCalled();

    dispatchPointerUp(window, { pointerId: 1, clientX: 125, clientY: 100 });

    expect(placement).toEqual({
      sourceContainerId: "left",
      containerId: "right",
      previousDraggableId: null,
      nextDraggableId: null,
      targetDraggableId: null,
      side: null,
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
      targetDraggableId: "b",
      side: "after",
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

  function createKeyboardHandlerEvent(input: {
    target: EventTarget | null;
    key: string;
  }) {
    return {
      target: input.target,
      key: input.key,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
  }

  function expectSortableRegistrations(draggableIds: readonly string[]): void {
    for (const draggableId of draggableIds) {
      expect(runtime.getDropTargetRegistration(draggableId, "rows")).toMatchObject(
        {
          id: draggableId,
          group: "rows",
          capabilities: {
            sortable: true,
          },
        },
      );
    }
  }

  function configureRuntimeCallbacks(
    lifecycleCallbacks: Parameters<DragRuntime["configure"]>[0]["lifecycleCallbacks"],
    options: Partial<
      Pick<
        Parameters<DragRuntime["configure"]>[0],
        "hasDragOverlay" | "targetingAlgorithm" | "targetingConstraint"
      >
    > = {},
  ): void {
    runtime.configure({
      targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
      targetingConstraint: options.targetingConstraint,
      hasDragOverlay: options.hasDragOverlay ?? false,
      overlayRelease: "auto",
      lifecycleCallbacks,
      keyboardConfiguration: undefined,
      modifiers: [],
      pointerConfiguration: undefined,
    });
  }

  function createLargeSortableTargetList(input: {
    itemCount: number;
    axis?: SortableAxis;
  }) {
    const axis = input.axis ?? "vertical";
    const list = document.createElement("div");
    document.body.append(list);
    const elements = Array.from({ length: input.itemCount }, (_, index) => {
      const element = createUnattachedSortableElement(
        `item-${index}`,
        axis === "horizontal"
          ? createRect({ left: index * 30, width: 20, height: 20 })
          : createRect({ top: index * 30, width: 20, height: 20 }),
      );

      return element;
    });
    const sourceElement = elements[0];

    if (!sourceElement) {
      throw new Error("Expected sortable source element");
    }

    list.append(...elements);
    const sourceBehavior = createDomSortable({
      runtime,
      draggableId: "item-0",
      group: "rows",
      axis,
      getElement: () => sourceElement,
    });

    sourceBehavior.setElement(sourceElement);

    for (let index = 1; index < elements.length; index += 1) {
      const element = elements[index];

      if (!element) {
        throw new Error("Expected sortable target element");
      }

      runtime.registerDropTarget(`item-${index}`, element, "rows", {
        sortable: true,
        sortableAxis: axis,
      });
    }

    return {
      list,
      elements,
      sourceBehavior,
    };
  }

  function createLargeSortablePreviewList(input: {
    itemCount: number;
    axis?: SortableAxis;
  }) {
    const axis = input.axis ?? "vertical";
    const list = document.createElement("div");
    document.body.append(list);
    const elements = Array.from({ length: input.itemCount }, (_, index) =>
      createUnattachedSortableElement(
        `item-${index}`,
        axis === "horizontal"
          ? createRect({ left: index * 30, width: 20, height: 20 })
          : createRect({ top: index * 30, width: 20, height: 20 }),
      ),
    );
    const sourceElement = elements[0];
    const targetElement = elements[1];

    if (!sourceElement || !targetElement) {
      throw new Error("Expected sortable preview source and target elements");
    }

    list.append(...elements);
    const sourceBehavior = createDomSortable({
      runtime,
      draggableId: "item-0",
      group: "rows",
      axis,
      getElement: () => sourceElement,
    });
    const targetBehavior = createDomSortable({
      runtime,
      draggableId: "item-1",
      group: "rows",
      axis,
      getElement: () => targetElement,
    });

    sourceBehavior.setElement(sourceElement);
    targetBehavior.setElement(targetElement);

    return {
      list,
      elements,
      sourceBehavior,
    };
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

  function createDynamicFourItemSortableList(containerId?: string) {
    const list = document.createElement("div");
    document.body.append(list);
    const a = createDynamicSortableElement("a", list);
    const b = createDynamicSortableElement("b", list);
    const c = createDynamicSortableElement("c", list);
    const d = createDynamicSortableElement("d", list);
    list.append(a, b, c, d);
    const behaviorA = createDomSortable({
      runtime,
      draggableId: "a",
      group: "rows",
      containerId,
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "rows",
      containerId,
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "rows",
      containerId,
      getElement: () => c,
    });
    const behaviorD = createDomSortable({
      runtime,
      draggableId: "d",
      group: "rows",
      containerId,
      getElement: () => d,
    });

    behaviorA.setElement(a);
    behaviorB.setElement(b);
    behaviorC.setElement(c);
    behaviorD.setElement(d);

    return {
      list,
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

  function createMixedFiveGroupSortableList() {
    const list = document.createElement("div");
    document.body.append(list);
    const one = createDynamicSortableElement("one", list);
    const two = createDynamicSortableElement("two", list);
    const isolated = createDynamicSortableElement("isolated-three", list);
    const four = createDynamicSortableElement("four", list);
    const five = createDynamicSortableElement("five", list);
    list.append(one, two, isolated, four, five);
    const behaviorOne = createDomSortable({
      runtime,
      draggableId: "one",
      group: "rows",
      getElement: () => one,
    });
    const behaviorTwo = createDomSortable({
      runtime,
      draggableId: "two",
      group: "rows",
      getElement: () => two,
    });
    const behaviorIsolated = createDomSortable({
      runtime,
      draggableId: "isolated-three",
      group: "isolated-rows",
      getElement: () => isolated,
    });
    const behaviorFour = createDomSortable({
      runtime,
      draggableId: "four",
      group: "rows",
      getElement: () => four,
    });
    const behaviorFive = createDomSortable({
      runtime,
      draggableId: "five",
      group: "rows",
      getElement: () => five,
    });

    behaviorOne.setElement(one);
    behaviorTwo.setElement(two);
    behaviorIsolated.setElement(isolated);
    behaviorFour.setElement(four);
    behaviorFive.setElement(five);

    return {
      list,
      rows: {
        one,
        two,
        four,
        five,
      },
      isolated,
      behaviors: {
        one: behaviorOne,
        two: behaviorTwo,
        isolated: behaviorIsolated,
        four: behaviorFour,
        five: behaviorFive,
      },
    };
  }

  function createSortableBoard(input: {
    rightItems: ("b" | "c")[];
    axis?: SortableAxis;
    placementBoundary?: SortableTestOptions["placementBoundary"];
    rightContainerRect?: ReturnType<typeof createRect>;
    bRect?: ReturnType<typeof createRect>;
    cRect?: ReturnType<typeof createRect>;
  }) {
    const axis = input.axis ?? "vertical";
    const leftContainer = createContainer(
      "left",
      createRect({ left: 0, top: 0, width: 50, height: 200 }),
    );
    const rightContainer = createContainer(
      "right",
      input.rightContainerRect ??
        (axis === "horizontal"
          ? createRect({ left: 100, top: 0, width: 200, height: 50 })
          : createRect({ left: 100, top: 0, width: 50, height: 200 })),
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
      input.cRect ??
        (axis === "horizontal"
          ? createRect({ left: 160, top: 0, width: 50, height: 20 })
          : createRect({ left: 100, top: 30, width: 50, height: 20 })),
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
      axis,
      placementBoundary: input.placementBoundary,
      getElement: () => a,
    });
    const behaviorB = createDomSortable({
      runtime,
      draggableId: "b",
      group: "cards",
      containerId: "right",
      axis,
      placementBoundary: input.placementBoundary,
      getElement: () => b,
    });
    const behaviorC = createDomSortable({
      runtime,
      draggableId: "c",
      group: "cards",
      containerId: "right",
      axis,
      placementBoundary: input.placementBoundary,
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
  const element = createUnattachedSortableElement(draggableId, rect);
  document.body.append(element);
  return element;
}

function createUnattachedSortableElement(
  draggableId: string,
  rect: ReturnType<typeof createRect>,
) {
  const element = document.createElement("div");
  element.dataset.draggableId = draggableId;
  stubBoundingClientRect(element, rect);
  return element;
}

function createMutableSortableElement(
  draggableId: string,
  getRect: () => ReturnType<typeof createRect>,
): HTMLElement {
  const element = document.createElement("div");
  element.dataset.draggableId = draggableId;
  document.body.append(element);
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(
    () => getRect() as DOMRect,
  );
  return element;
}

function createDynamicSortableElement(
  draggableId: string,
  list: HTMLElement,
): HTMLElement {
  const element = document.createElement("div");
  element.dataset.draggableId = draggableId;
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => {
    const childIndex = Array.prototype.indexOf.call(list.children, element) as
      | number
      | undefined;
    const index = childIndex === undefined || childIndex < 0 ? 0 : childIndex;

    return createRect({ top: index * 30, width: 20, height: 20 }) as DOMRect;
  });
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

function mockWindowScrollOffset(): {
  set: (offset: { x?: number; y?: number }) => void;
  restore: () => void;
} {
  let scrollX = 0;
  let scrollY = 0;
  const scrollXSpy = vi
    .spyOn(window, "scrollX", "get")
    .mockImplementation(() => scrollX);
  const scrollYSpy = vi
    .spyOn(window, "scrollY", "get")
    .mockImplementation(() => scrollY);

  return {
    set: (offset) => {
      scrollX = offset.x ?? scrollX;
      scrollY = offset.y ?? scrollY;
    },
    restore: () => {
      scrollXSpy.mockRestore();
      scrollYSpy.mockRestore();
    },
  };
}

function reorderDataWithSortablePlacement(
  items: readonly string[],
  draggableId: string,
  placement: SortableDropPlacement,
): string[] {
  const withoutItem = items.filter((item) => item !== draggableId);

  if (placement.targetDraggableId !== null && placement.side !== null) {
    const targetIndex = withoutItem.indexOf(placement.targetDraggableId);

    if (targetIndex === -1) {
      return [...items];
    }

    const insertIndex =
      placement.side === "after" ? targetIndex + 1 : targetIndex;

    return [
      ...withoutItem.slice(0, insertIndex),
      draggableId,
      ...withoutItem.slice(insertIndex),
    ];
  }

  if (placement.previousDraggableId !== null) {
    const previousIndex = withoutItem.indexOf(placement.previousDraggableId);

    if (previousIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, previousIndex + 1),
      draggableId,
      ...withoutItem.slice(previousIndex + 1),
    ];
  }

  if (placement.nextDraggableId !== null) {
    const nextIndex = withoutItem.indexOf(placement.nextDraggableId);

    if (nextIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, nextIndex),
      draggableId,
      ...withoutItem.slice(nextIndex),
    ];
  }

  return [...items];
}
