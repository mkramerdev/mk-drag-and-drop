import { describe, expect, it, vi } from "vitest";

import {
  createDomDraggable,
  createDomDropContainer,
  createDomDroppable,
  createDragRuntime,
  pointerToCenter,
} from "../src/index.js";
import {
  createPointerHandlerEvent,
  createRect,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("DOM behaviors", () => {
  it("createDomDraggable ignores non-primary and right-button pointer starts", () => {
    const element = document.createElement("div");
    const runtime = createDraggableRuntime();
    const draggable = createDomDraggable({
      runtime,
      draggableId: "item-1",
      group: "items",
      getElement: () => element,
    });
    const nonPrimaryEvent = createPointerHandlerEvent({
      target: element,
      isPrimary: false,
    });
    const rightButtonEvent = createPointerHandlerEvent({
      target: element,
      button: 2,
    });

    draggable.onPointerDown(nonPrimaryEvent);
    draggable.onPointerDown(rightButtonEvent);

    expect(runtime.requestDragStart).not.toHaveBeenCalled();
    expect(nonPrimaryEvent.preventDefault).not.toHaveBeenCalled();
    expect(rightButtonEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it("createDomDraggable ignores interactive descendants unless a drag handle is used", () => {
    const element = document.createElement("div");
    const button = document.createElement("button");
    const handle = document.createElement("button");
    handle.dataset.dndDragHandle = "true";
    element.append(button, handle);
    const runtime = createDraggableRuntime();
    const draggable = createDomDraggable({
      runtime,
      draggableId: "item-1",
      group: "items",
      getElement: () => element,
    });
    const buttonEvent = createPointerHandlerEvent({ target: button });
    const handleEvent = createPointerHandlerEvent({ target: handle });

    draggable.onPointerDown(buttonEvent);
    draggable.onPointerDown(handleEvent);

    expect(runtime.requestDragStart).toHaveBeenCalledTimes(1);
    expect(buttonEvent.preventDefault).not.toHaveBeenCalled();
    expect(handleEvent.preventDefault).toHaveBeenCalled();
    expect(handleEvent.stopPropagation).toHaveBeenCalled();
  });

  it("createDomDraggable prevents default only when starting a drag", () => {
    const element = document.createElement("div");
    const child = document.createElement("span");
    element.append(child);
    const runtime = createDraggableRuntime();
    const draggable = createDomDraggable({
      runtime,
      draggableId: "item-1",
      group: "items",
      getElement: () => element,
    });
    const event = createPointerHandlerEvent({ target: child });

    draggable.onPointerDown(event);

    expect(runtime.requestDragStart).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("createDomDroppable registers and unregisters by ref lifecycle", () => {
    const runtime = {
      registerDropTarget: vi.fn(),
      unregisterDropTarget: vi.fn(),
    };
    const first = document.createElement("div");
    const second = document.createElement("div");
    const droppable = createDomDroppable({
      runtime,
      targetId: "target-1",
      group: "items",
    });

    droppable.setElement(first);
    droppable.setElement(first);
    droppable.setElement(second);
    droppable.cleanup();

    expect(runtime.registerDropTarget).toHaveBeenCalledTimes(2);
    expect(runtime.registerDropTarget).toHaveBeenNthCalledWith(
      1,
      "target-1",
      first,
      "items",
      { containerId: null },
    );
    expect(runtime.registerDropTarget).toHaveBeenNthCalledWith(
      2,
      "target-1",
      second,
      "items",
      { containerId: null },
    );
    expect(runtime.unregisterDropTarget).toHaveBeenCalledTimes(2);
    expect(runtime.unregisterDropTarget).toHaveBeenNthCalledWith(
      1,
      "target-1",
      first,
    );
    expect(runtime.unregisterDropTarget).toHaveBeenNthCalledWith(
      2,
      "target-1",
      second,
    );
  });

  it("createDomDropContainer registers and unregisters by ref lifecycle", () => {
    const runtime = {
      registerDropContainer: vi.fn(),
      unregisterDropContainer: vi.fn(),
    };
    const first = document.createElement("div");
    const second = document.createElement("div");
    let currentElement: HTMLElement | null = null;
    const container = createDomDropContainer({
      runtime,
      containerId: "container-1",
      group: "items",
      getElement: () => currentElement,
    });

    currentElement = first;
    container.setElement(first);
    container.setElement(first);
    currentElement = second;
    container.setElement(second);
    container.cleanup();

    expect(runtime.registerDropContainer).toHaveBeenCalledTimes(2);
    expect(runtime.registerDropContainer).toHaveBeenNthCalledWith(
      1,
      "container-1",
      first,
      "items",
    );
    expect(runtime.registerDropContainer).toHaveBeenNthCalledWith(
      2,
      "container-1",
      second,
      "items",
    );
    expect(runtime.unregisterDropContainer).toHaveBeenCalledTimes(2);
    expect(runtime.unregisterDropContainer).toHaveBeenNthCalledWith(
      1,
      "container-1",
      first,
    );
    expect(runtime.unregisterDropContainer).toHaveBeenNthCalledWith(
      2,
      "container-1",
      second,
    );
  });

  it("stale droppable cleanup does not remove a newer target registration", () => {
    const runtime = createDragRuntime();
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
    const oldElement = document.createElement("div");
    const newElement = document.createElement("div");
    document.body.append(oldElement, newElement);
    stubBoundingClientRect(oldElement, createRect({ left: 0, width: 10 }));
    stubBoundingClientRect(newElement, createRect({ left: 40, width: 10 }));
    const oldDroppable = createDomDroppable({
      runtime,
      targetId: "target-1",
      group: "items",
    });
    const newDroppable = createDomDroppable({
      runtime,
      targetId: "target-1",
      group: "items",
    });

    oldDroppable.setElement(oldElement);
    newDroppable.setElement(newElement);
    oldDroppable.cleanup();

    expect(runtime.getDropTargetRect("target-1")).toEqual(
      createRect({ left: 40, width: 10 }),
    );

    runtime.dispose();
  });

  it("reusing a replaced droppable element does not remove the current target", () => {
    const runtime = createDragRuntime();
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
    const oldElement = document.createElement("div");
    const newElement = document.createElement("div");
    document.body.append(oldElement, newElement);
    stubBoundingClientRect(oldElement, createRect({ left: 0, width: 10 }));
    stubBoundingClientRect(newElement, createRect({ left: 40, width: 10 }));
    const oldTarget = createDomDroppable({
      runtime,
      targetId: "target-1",
      group: "items",
    });
    const newTarget = createDomDroppable({
      runtime,
      targetId: "target-1",
      group: "items",
    });
    const reusedTarget = createDomDroppable({
      runtime,
      targetId: "target-2",
      group: "items",
    });

    oldTarget.setElement(oldElement);
    newTarget.setElement(newElement);
    reusedTarget.setElement(oldElement);

    expect(runtime.getDropTargetRect("target-1")).toEqual(
      createRect({ left: 40, width: 10 }),
    );
    expect(runtime.getDropTargetRect("target-2")).toEqual(
      createRect({ left: 0, width: 10 }),
    );

    runtime.dispose();
  });
});

function createDraggableRuntime() {
  return {
    requestDragStart: vi.fn(),
    isKeyboardDragEnabled: () => true,
    handleSourceKeyboardKeyDown: vi.fn(() => true),
  };
}
