import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDropContainer,
  createSortable,
  type DragController,
  type DropPlacement,
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
    controller?.dispose();
    controller = null;
    raf?.restore();
    raf = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("registers sortable items that participate in sortable drops", () => {
    let placement: DropPlacement | null = null;
    const { list, a, b } = setupSortablePair({
      onDrop: ({ draggableId }, helpers) => {
        placement = helpers.getDropPlacement(draggableId);
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
      draggableId: "a",
      dropTarget: "b",
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
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
    let placement: DropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ draggableId }, helpers) => {
        placement = helpers.getDropPlacement(draggableId);
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
      draggableId: "a",
      dropTarget: "b",
      sourceContainerId: "column-a",
      containerId: "column-a",
      previousDraggableId: "b",
      nextDraggableId: null,
    });
  });

  it("returns void", () => {
    controller = createDragController();
    const element = createMeasuredElement(createRect({ width: 20, height: 20 }));

    const result = createSortable({ controller, element, draggableId: "item" });

    expect(result).toBeUndefined();
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

  it("supports vanilla-style rerender without storing item cleanup callbacks", () => {
    let placement: DropPlacement | null = null;
    controller = createDragController({
      onDrop: ({ draggableId }, helpers) => {
        placement = helpers.getDropPlacement(draggableId);
      },
    });
    raf = installMockRaf();
    const list = document.createElement("div");
    document.body.append(list);

    render(["a", "b"]);
    render(["a", "b"]);

    const [a, b] = Array.from(list.children) as HTMLElement[];
    dragToTarget(a, b);

    expect(placement).toEqual({
      draggableId: "a",
      dropTarget: "b",
      sourceContainerId: null,
      containerId: null,
      previousDraggableId: "b",
      nextDraggableId: null,
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

  it("cleans up sortable listeners and registration when the controller is disposed", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement(
      createRect({ left: 0, top: 0, width: 20, height: 20 }),
    );
    element.setAttribute("tabindex", "2");

    createSortable({ controller, element, draggableId: "item" });
    controller.dispose();

    expect(element.getAttribute("tabindex")).toBe("2");
    expect(
      getControllerRuntime(controller).getDropTargetRegistration("item"),
    ).toBeNull();

    dispatchPointerDown(element, { pointerId: 1 });
    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
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
