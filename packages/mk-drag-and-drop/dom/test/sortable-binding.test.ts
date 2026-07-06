import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDropContainer,
  createSortable,
  type DragController,
  type SortableDropPlacement,
} from "../src/index.js";
import { getControllerRuntime } from "../src/controller/controller-internals.js";
import {
  createRect,
  dispatchKeyDown,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createSortable", () => {
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

  it("registers sortable items that participate in sortable drops", () => {
    let placement: SortableDropPlacement | null = null;
    const { list, a, b } = setupSortablePair({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement ?? null;
      },
    });

    expect(
      controller
        ? getControllerRuntime(controller).getDropTargetRegistration("a")
        : null,
    ).toMatchObject({
      id: "a",
      capabilities: {
        container: false,
        sortable: true,
      },
    });

    dragToTarget(a, b);

    expect(Array.from(list.children)).toEqual([a, b]);
    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
      targetDraggableId: "b",
      side: "after",
    });
  });

  it("keeps detached pre-mount sortable bindings available after the subtree is mounted", () => {
    let placement: SortableDropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement ?? null;
      },
    });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const list = document.createElement("div");
    const a = createDetachedMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    const b = createDetachedMeasuredElement(
      createRect({ left: 0, top: 30, width: 20, height: 20 }),
    );

    list.append(a, b);
    createSortable({ controller, element: a, draggableId: "a" });
    createSortable({ controller, element: b, draggableId: "b" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);

    document.body.append(list);
    dragToTarget(a, b);

    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
      targetDraggableId: "b",
      side: "after",
    });
  });

  it("starts pointer drags through createDomSortable", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );

    createSortable({ controller, element, draggableId: "item" });
    dispatchPointerDown(element, { pointerId: 1, clientX: 3, clientY: 4 });

    expect(onDragStart).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        pointerPosition: { x: 3, y: 4 },
        sourceRect: createRect({ left: 0, top: 0, width: 20, height: 20 }),
      },
      expect.any(Object),
    );
  });

  it("binds keyboard drag when keyboard dragging is enabled", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    element.setAttribute("tabindex", "7");

    createSortable({ controller, element, draggableId: "item" });

    expect(element.getAttribute("tabindex")).toBe("0");

    dispatchKeyDown(element, "Space");

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "item" }),
      expect.any(Object),
    );
  });

  it("does not bind keyboard drag when keyboard dragging is disabled", () => {
    const onDragStart = vi.fn();
    controller = createDragController({
      keyboardConfiguration: { enabled: false },
      onDragStart,
    });
    const element = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );

    createSortable({ controller, element, draggableId: "item" });

    expect(element.hasAttribute("tabindex")).toBe(false);

    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("passes container metadata into sortable registration", () => {
    let placement: SortableDropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement ?? null;
      },
    });
    raf = installMockRaf();
    const container = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 80, height: 120 }),
    );
    const a = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    const b = createMeasuredElement(
      createRect({ left: 0, top: 30, width: 20, height: 20 }),
    );
    container.append(a, b);

    createDropContainer({
      controller,
      element: container,
      containerId: "column-a",
      group: "cards",
    });
    createSortable({
      controller,
      element: a,
      draggableId: "a",
      group: "cards",
      containerId: "column-a",
    });
    createSortable({
      controller,
      element: b,
      draggableId: "b",
      group: "cards",
      containerId: "column-a",
    });

    dragToTarget(a, b);

    expect(placement).toEqual({
      sourceContainerId: "column-a",
      containerId: "column-a",
      previousDraggableId: "b",
      nextDraggableId: null,
      targetDraggableId: "b",
      side: "after",
    });
  });

  it("makes a removed sortable item unavailable without cleanup", () => {
    const onDrop = vi.fn();
    const { a, b } = setupSortablePair({ onDrop });

    a.remove();

    expect(
      controller ? getControllerRuntime(controller).getDropTargetRegistration("a") : null,
    ).toBeNull();

    dragToTarget(a, b);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("self-prunes after the bound element is removed", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const runtime = getControllerRuntime(controller);
    const element = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    element.setAttribute("tabindex", "2");

    createSortable({ controller, element, draggableId: "item" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);
    expect(element.getAttribute("data-dnd-sortable-draggable")).toBe("true");

    element.remove();
    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(0);
    expect(runtime.getDropTargetRegistration("item")).toBeNull();
    expect(element.hasAttribute("data-dnd-sortable-draggable")).toBe(false);
    expect(element.getAttribute("tabindex")).toBe("2");

    document.body.append(element);
    dispatchPointerDown(element, { pointerId: 1 });
    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("keeps a newer same-id sortable registration when the old binding self-prunes", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const oldElement = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    const newElement = createMeasuredElement(
      createRect({ left: 40, top: 0, width: 20, height: 20 }),
    );

    createSortable({ controller, element: oldElement, draggableId: "item" });
    oldElement.remove();
    createSortable({ controller, element: newElement, draggableId: "item" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);
    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);
    expect(runtime.getDropTargetRegistration("item")?.element).toBe(newElement);
    expect(oldElement.hasAttribute("data-dnd-sortable-draggable")).toBe(false);
    expect(newElement.getAttribute("data-dnd-sortable-draggable")).toBe("true");
  });

  it("supports vanilla-style rerender while pruning stale binding records", () => {
    let placement: SortableDropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement ?? null;
      },
    });
    raf = installMockRaf();
    const list = document.createElement("div");
    document.body.append(list);
    const runtime = getControllerRuntime(controller);

    for (let index = 0; index < 8; index += 1) {
      render(["a", "b"]);
      runtime.pruneDisconnectedDomBindings();

      expect(runtime.getStaleDomBindingRecordCount()).toBe(2);
    }

    const [a, b] = Array.from(list.children) as HTMLElement[];
    dragToTarget(a, b);

    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
      targetDraggableId: "b",
      side: "after",
    });

    function render(draggableIds: string[]): void {
      list.replaceChildren(
        ...draggableIds.map((draggableId, index) => {
          const element = createMeasuredElement(
            createRect({ left: 0, top: index * 30, width: 20, height: 20 }),
          );
          createSortable({ controller: controller!, element, draggableId });
          return element;
        }),
      );
    }
  });

  it("clears sortable state before user onDrop synchronously replaces sortable DOM", () => {
    let draggedStateDuringDrop: string | undefined;
    let placement: SortableDropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ sortablePlacement }) => {
        placement = sortablePlacement ?? null;
        const activeElement = list.querySelector<HTMLElement>(
          "[data-sortable-id='a']",
        );

        draggedStateDuringDrop = activeElement?.dataset.dndDragged;
        render(["b", "a"]);
      },
    });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const list = document.createElement("div");
    document.body.append(list);

    render(["a", "b"]);

    const [a, b] = Array.from(list.children) as HTMLElement[];
    dragToTarget(a, b);
    runtime.pruneDisconnectedDomBindings();

    expect(draggedStateDuringDrop).toBeUndefined();
    expect(placement).toEqual({
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
      targetDraggableId: "b",
      side: "after",
    });
    expect(getSortableItemIds(list).slice(0, 2)).toEqual(["b", "a"]);
    expect(runtime.getStaleDomBindingRecordCount()).toBe(2);

    function render(draggableIds: string[]): void {
      list.replaceChildren(
        ...draggableIds.map((draggableId, index) => {
          const element = createDetachedMeasuredElement(
            createRect({ left: 0, top: index * 30, width: 20, height: 20 }),
          );

          element.dataset.sortableId = draggableId;
          createSortable({ controller: controller!, element, draggableId });
          return element;
        }),
      );
    }
  });

  it("handles vanilla-style bulk sortable rerender during drop", () => {
    const itemCount = 1_000;
    let items = Array.from(
      { length: itemCount },
      (_, index) => `item-${index}`,
    );
    controller = createDragController({
      onDrop: ({ draggableId, sortablePlacement }) => {
        if (!sortablePlacement) {
          return;
        }

        items = moveItemToSortablePlacement(
          items,
          draggableId,
          sortablePlacement,
        );
        render();
      },
    });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const list = document.createElement("div");
    document.body.append(list);

    render();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(itemCount);

    const [source, target] = Array.from(list.children) as HTMLElement[];
    dragToTarget(source, target);
    expect(runtime.getStaleDomBindingRecordCount()).toBe(itemCount * 2);
    runtime.pruneDisconnectedDomBindings();

    expect(items.slice(0, 4)).toEqual([
      "item-1",
      "item-0",
      "item-2",
      "item-3",
    ]);
    expect(getSortableItemIds(list).slice(0, 4)).toEqual(items.slice(0, 4));
    expect(runtime.getStaleDomBindingRecordCount()).toBe(itemCount);

    function render(): void {
      list.replaceChildren(
        ...items.map((draggableId, index) => {
          const element = createDetachedMeasuredElement(
            createRect({ left: 0, top: index * 30, width: 20, height: 20 }),
          );

          element.dataset.sortableId = draggableId;
          createSortable({ controller: controller!, element, draggableId });
          return element;
        }),
      );
    }
  });

  it("supports vanilla-style keyed DOM commit without recreating bindings", () => {
    const itemElements = new Map<string, HTMLElement>();
    let items = ["a", "b", "c"];
    let orderBeforeCommit: string[] = [];
    let orderAfterCommit: string[] = [];
    controller = createDragController({
      onDrop: ({ draggableId, sortablePlacement }) => {
        if (!sortablePlacement) {
          return;
        }

        orderBeforeCommit = getSortableItemIds(list);
        items = moveItemToSortablePlacement(items, draggableId, sortablePlacement);
        moveSortableElementToPlacement({
          itemElements,
          list,
          draggableId,
          placement: sortablePlacement,
        });
        orderAfterCommit = getSortableItemIds(list);
      },
    });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const list = document.createElement("div");
    document.body.append(list);

    for (const [index, draggableId] of items.entries()) {
      const element = createDetachedMeasuredElement(
        createRect({ left: 0, top: index * 30, width: 20, height: 20 }),
      );

      element.dataset.sortableId = draggableId;
      itemElements.set(draggableId, element);
      createSortable({ controller, element, draggableId });
      list.append(element);
    }

    const [a, b] = Array.from(list.children) as HTMLElement[];
    dragToTarget(a, b);

    expect(orderBeforeCommit).toEqual(["a", "b", "c"]);
    expect(orderAfterCommit).toEqual(["b", "a", "c"]);
    expect(items).toEqual(["b", "a", "c"]);
    expect(getSortableItemIds(list)).toEqual(["b", "a", "c"]);
    expect(runtime.getStaleDomBindingRecordCount()).toBe(3);
  });

  function setupSortablePair(input: {
    onDrop?: NonNullable<Parameters<typeof createDragController>[0]>["onDrop"];
  }): {
    list: HTMLElement;
    a: HTMLElement;
    b: HTMLElement;
  } {
    controller = createDragController({
      onDrop: input.onDrop,
    });
    raf = installMockRaf();
    const list = document.createElement("div");
    document.body.append(list);
    const a = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    const b = createMeasuredElement(
      createRect({ left: 0, top: 30, width: 20, height: 20 }),
    );
    list.append(a, b);

    createSortable({ controller, element: a, draggableId: "a" });
    createSortable({ controller, element: b, draggableId: "b" });

    return {
      list,
      a,
      b,
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

function getSortableItemIds(list: HTMLElement): string[] {
  return Array.from(list.children, (element) =>
    (element as HTMLElement).dataset.sortableId ?? "",
  );
}

function moveItemToSortablePlacement(
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

function moveSortableElementToPlacement(input: {
  itemElements: Map<string, HTMLElement>;
  list: HTMLElement;
  draggableId: string;
  placement: SortableDropPlacement;
}): void {
  const element = input.itemElements.get(input.draggableId);

  if (!element) {
    return;
  }

  if (
    input.placement.targetDraggableId !== null &&
    input.placement.side !== null
  ) {
    const target = input.itemElements.get(input.placement.targetDraggableId);

    if (!target) {
      return;
    }

    if (input.placement.side === "after") {
      target.after(element);
    } else {
      target.before(element);
    }

    return;
  }

  if (input.placement.previousDraggableId !== null) {
    const previous = input.itemElements.get(input.placement.previousDraggableId);

    if (previous) {
      previous.after(element);
    }

    return;
  }

  if (input.placement.nextDraggableId !== null) {
    const next = input.itemElements.get(input.placement.nextDraggableId);

    if (next) {
      next.before(element);
    }

    return;
  }

  input.list.append(element);
}
