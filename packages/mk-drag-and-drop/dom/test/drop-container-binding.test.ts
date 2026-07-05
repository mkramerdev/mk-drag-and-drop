import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDropContainer,
  type DragController,
  type DropPlacement,
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
      draggableId: "item",
      dropTarget: "column-a",
      sourceContainerId: null,
      containerId: "column-a",
      previousDraggableId: null,
      nextDraggableId: null,
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
      draggableId: "other-item",
      group: "other",
    });
    createDraggable({
      controller,
      element: secondSource,
      draggableId: "target-item",
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
      { draggableId: "target-item", dropTarget: "column-a" },
      expect.any(Object),
    );
  });

  it("makes a removed container unavailable without cleanup", () => {
    const { source, container, onDrop } = setupDragAndContainer({
      containerId: "column-a",
    });

    container.remove();
    dragToTarget(source, container);

    expect(onDrop).not.toHaveBeenCalled();
    expect(
      controller
        ? getControllerRuntime(controller).getDropTargetRegistration("column-a")
        : null,
    ).toBeNull();
  });

  it("self-prunes after the bound container is removed", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const container = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );

    createDropContainer({
      controller,
      element: container,
      containerId: "column-a",
    });

    expect(runtime.getBindingCleanupRecordCount()).toBe(1);

    container.remove();
    runtime.pruneDisconnectedBindingCleanups();

    expect(runtime.getBindingCleanupRecordCount()).toBe(0);
    expect(runtime.getDropTargetRegistration("column-a")).toBeNull();

    document.body.append(container);

    expect(runtime.getDropTargetRegistration("column-a")).toBeNull();
  });

  it("keeps a newer same-id container registration when the old binding self-prunes", () => {
    controller = createDragController();
    const runtime = getControllerRuntime(controller);
    const oldContainer = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );
    const newContainer = createMeasuredElement(
      createRect({ left: 200, top: 0, width: 80, height: 80 }),
    );

    createDropContainer({
      controller,
      element: oldContainer,
      containerId: "column-a",
    });
    oldContainer.remove();
    createDropContainer({
      controller,
      element: newContainer,
      containerId: "column-a",
    });

    expect(runtime.getBindingCleanupRecordCount()).toBe(1);
    expect(runtime.getDropTargetRegistration("column-a")?.element).toBe(
      newContainer,
    );
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
    onDrop: ReturnType<typeof vi.fn>;
    getPlacement: () => DropPlacement | null;
  } {
    let placement: DropPlacement | null = null;
    const onDrop = vi.fn(({ draggableId }, helpers) => {
      placement = helpers.getDropPlacement(draggableId);
    });
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const container = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );

    createDraggable({ controller, element: source, draggableId: "item" });
    createDropContainer({
      controller,
      element: container,
      containerId: input.containerId,
    });

    return {
      source,
      container,
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
