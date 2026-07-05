import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDropContainer,
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

  it("registers a container target", () => {
    const { source, container, onDrop } = setupDragAndContainer({
      containerId: "column-a",
    });

    dragToTarget(source, container);

    expect(onDrop).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        dropTargetId: "column-a",
      },
      expect.any(Object),
    );
    expect(onDrop.mock.calls[0]?.[0]).not.toHaveProperty("sortablePlacement");
  });

  it("keeps detached pre-mount container bindings available after the subtree is mounted", () => {
    const onDrop = vi.fn();
    controller = createDragController({ onDrop });
    raf = installMockRaf();
    const runtime = getControllerRuntime(controller);
    const root = document.createElement("div");
    const source = createDetachedMeasuredElement(
      createRect({ width: 20, height: 20 }),
    );
    const container = createDetachedMeasuredElement(
      createRect({ left: 100, top: 0, width: 80, height: 80 }),
    );

    root.append(source, container);
    createDropContainer({
      controller,
      element: container,
      containerId: "column-a",
    });
    createDraggable({ controller, element: source, draggableId: "item" });

    expect(runtime.getBindingCleanupRecordCount()).toBe(2);

    document.body.append(root);
    dragToTarget(source, container);

    expect(onDrop).toHaveBeenCalledWith(
      {
        draggableId: "item",
        source: "pointer",
        dropTargetId: "column-a",
      },
      expect.any(Object),
    );
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
      {
        draggableId: "target-item",
        source: "pointer",
        dropTargetId: "column-a",
      },
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
  } {
    const onDrop = vi.fn();
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
