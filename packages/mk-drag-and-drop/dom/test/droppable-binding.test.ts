import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  createDroppable,
  type DragController,
} from "../src/index.js";
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
    controller?.dispose();
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
      { itemId: "item", dropTarget: "target" },
      expect.any(Object),
    );
  });

  it("uses the default group", () => {
    const onDrop = vi.fn();
    const { source, target } = setupDragAndDrop({ onDrop });

    dragToTarget(source, target);

    expect(onDrop).toHaveBeenCalledTimes(1);
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
      itemId: "other-item",
      group: "other",
    });
    createDraggable({
      controller,
      element: secondSource,
      itemId: "target-item",
      group: "targets",
    });
    createDroppable({
      controller,
      element: target,
      targetId: "target",
      group: "targets",
    });

    dragToTarget(firstSource, target);

    expect(onDrop).not.toHaveBeenCalled();

    dragToTarget(secondSource, target);

    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "target-item", dropTarget: "target" },
      expect.any(Object),
    );
  });

  it("unregisters the target on cleanup", () => {
    const onDrop = vi.fn();
    const { source, target, cleanup } = setupDragAndDrop({ onDrop });

    cleanup();
    cleanup();
    dragToTarget(source, target);

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("unregisters the target when the controller is disposed", () => {
    const onDrop = vi.fn();
    const { source, target } = setupDragAndDrop({ onDrop });

    controller?.dispose();
    dragToTarget(source, target);

    expect(onDrop).not.toHaveBeenCalled();
  });

  function setupDragAndDrop(input: { onDrop: ReturnType<typeof vi.fn> }): {
    source: HTMLElement;
    target: HTMLElement;
    cleanup: () => void;
  } {
    controller = createDragController({ onDrop: input.onDrop });
    raf = installMockRaf();
    const source = createMeasuredElement(createRect({ width: 20, height: 20 }));
    const target = createMeasuredElement(
      createRect({ left: 100, top: 0, width: 20, height: 20 }),
    );

    createDraggable({ controller, element: source, itemId: "item" });
    const cleanup = createDroppable({
      controller,
      element: target,
      targetId: "target",
    });

    return {
      source,
      target,
      cleanup,
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
