import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDropContainer,
  type DragController,
  type DropPlacement,
} from "../src/index.js";
import {
  createRect,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createDropContainer", () => {
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

  it("registers a container target with placement metadata", () => {
    const { source, container, getPlacement } = setupDragAndContainer({
      containerId: "column-a",
    });

    dragToTarget(source, container);

    expect(getPlacement()).toEqual({
      itemId: "item",
      dropTarget: "column-a",
      sourceContainerId: null,
      containerId: "column-a",
      previousItemId: null,
      nextItemId: null,
    });
  });

  it("uses the default group", () => {
    const { source, container, onDrop } = setupDragAndContainer({
      containerId: "column-a",
    });

    dragToTarget(source, container);

    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("isolates custom groups", () => {
    const onDrop = vi.fn();
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const firstSource = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const secondSource = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const container = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );

    createDraggable({
      controller,
      element: firstSource,
      itemId: "other-item",
      group: "other",
    });
    createDraggable({
      controller,
      element: secondSource,
      itemId: "target-item",
      group: "cards",
    });
    createDropContainer({
      controller,
      element: container,
      containerId: "column-a",
      group: "cards",
    });

    dragToTarget(firstSource, container);

    expect(onDrop).not.toHaveBeenCalled();

    dragToTarget(secondSource, container);

    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "target-item", dropTarget: "column-a" },
      expect.any(Object),
    );
  });

  it("unregisters the container on cleanup", () => {
    const { source, container, cleanup, onDrop } = setupDragAndContainer({
      containerId: "column-a",
    });

    cleanup();
    cleanup();
    dragToTarget(source, container);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("unregisters the container when the controller is disposed", () => {
    const { source, container, onDrop } = setupDragAndContainer({
      containerId: "column-a",
    });

    controller?.dispose();
    dragToTarget(source, container);

    expect(onDrop).not.toHaveBeenCalled();
  });

  function setupDragAndContainer(input: { containerId: string }): {
    source: HTMLElement;
    container: HTMLElement;
    cleanup: () => void;
    onDrop: ReturnType<typeof vi.fn>;
    getPlacement: () => DropPlacement | null;
  } {
    let placement: DropPlacement | null = null;
    const onDrop = vi.fn(({ itemId }, helpers) => {
      placement = helpers.getDropPlacement(itemId);
    });
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const container = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );

    createDraggable({ controller, element: source, itemId: "item" });
    const cleanup = createDropContainer({
      controller,
      element: container,
      containerId: input.containerId,
    });

    return {
      source,
      container,
      cleanup,
      onDrop,
      getPlacement: () => placement,
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
