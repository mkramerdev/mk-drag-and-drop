import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
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

describe("createDraggable", () => {
  let controller: DragController | null = null;

  afterEach(() => {
    controller
      ? getControllerRuntime(controller).releaseActiveDragResources()
      : undefined;
    controller = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("starts pointer drags through createDomDraggable", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement();

    createDraggable({ controller, element, draggableId: "item" });
    dispatchPointerDown(element, { pointerId: 1, clientX: 4, clientY: 5 });

    expect(onDragStart).toHaveBeenCalledWith(
      {
        draggableId: "item",
        group: "default",
        source: "pointer",
        pointerPosition: { x: 4, y: 5 },
        sourceRect: createRect({ width: 20, height: 20 }),
      },
      expect.any(Object),
    );
  });

  it.each(["child", "draggable"])(
    "preserves link activation and suppresses native dragging for a link as the %s",
    (position) => {
      const onDragStart = vi.fn();
      controller = createDragController({
        onDragStart,
        pointerConfiguration: { activationDistance: 10 },
      });
      const link = document.createElement("a");
      link.href = "#destination";
      const element = position === "child" ? createMeasuredElement() : link;
      if (position === "child") {
        element.append(link);
      } else {
        document.body.append(link);
      }
      createDraggable({ controller, element, draggableId: "item" });

      const otherLink = document.createElement("a");
      document.body.append(otherLink);
      const dispatchNativeDrag = (target = link) =>
        target.dispatchEvent(
          new Event("dragstart", { bubbles: true, cancelable: true }),
        );
      const dispatchClick = () =>
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            detail: 1,
          }),
        );

      link.focus();
      expect(document.activeElement).toBe(link);
      expect(dispatchKeyDown(link, "Enter")).toBe(true);
      expect(onDragStart).not.toHaveBeenCalled();

      expect(dispatchPointerDown(link)).toBe(true);
      expect(dispatchNativeDrag()).toBe(false);
      expect(dispatchNativeDrag(otherLink)).toBe(true);
      dispatchPointerUp(link);
      expect(dispatchClick()).toBe(true);
      expect(dispatchNativeDrag()).toBe(true);
      expect(onDragStart).not.toHaveBeenCalled();

      dispatchPointerDown(link);
      dispatchPointerMove(link, { clientX: 15 });
      expect(onDragStart).toHaveBeenCalledTimes(1);
      expect(onDragStart).toHaveBeenCalledWith(
        expect.objectContaining({ draggableId: "item", source: "pointer" }),
        expect.any(Object),
      );
      expect(dispatchNativeDrag()).toBe(false);
      dispatchPointerUp(link, { clientX: 15 });
      expect(dispatchClick()).toBe(false);
      expect(dispatchNativeDrag()).toBe(true);
    },
  );

  it("releases native drag suppression when an immediate pointer drag is canceled", () => {
    controller = createDragController();
    const link = document.createElement("a");
    link.href = "#destination";
    document.body.append(link);
    createDraggable({ controller, element: link, draggableId: "link" });
    const dispatchNativeDrag = () =>
      link.dispatchEvent(
        new Event("dragstart", { bubbles: true, cancelable: true }),
      );

    dispatchPointerDown(link);
    expect(dispatchNativeDrag()).toBe(false);
    dispatchPointerCancel(link);
    expect(dispatchNativeDrag()).toBe(true);
  });

  it("binds keyboard drag when keyboard dragging is enabled", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement();
    element.setAttribute("tabindex", "7");

    createDraggable({ controller, element, draggableId: "item" });

    expect(element.getAttribute("tabindex")).toBe("0");

    dispatchKeyDown(element, "Space");

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "item", source: "keyboard" }),
      expect.any(Object),
    );
  });

  it("does not bind keyboard drag when keyboard dragging is disabled", () => {
    const onDragStart = vi.fn();
    controller = createDragController({
      keyboardConfiguration: { enabled: false },
      onDragStart,
    });
    const element = createMeasuredElement();

    createDraggable({ controller, element, draggableId: "item" });

    expect(element.hasAttribute("tabindex")).toBe(false);

    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("cancels pending pointer activation through the controller", () => {
    vi.useFakeTimers();
    const onDragStart = vi.fn();
    controller = createDragController({
      onDragStart,
      pointerConfiguration: { activationDelay: 200 },
    });
    const element = createMeasuredElement();
    createDraggable({ controller, element, draggableId: "item" });

    dispatchPointerDown(element, { pointerId: 1 });
    controller.cancelDrag();
    vi.advanceTimersByTime(250);
    dispatchPointerMove(window, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    expect(onDragStart).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("cancels an active keyboard drag through the controller", () => {
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    controller = createDragController({ onDragEnd, onDrop });
    const element = createMeasuredElement();
    createDraggable({ controller, element, draggableId: "item" });

    dispatchKeyDown(element, "Space");
    controller.cancelDrag();

    expect(onDragEnd).toHaveBeenCalledWith(
      expect.objectContaining({ source: "keyboard", result: "canceled" }),
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("self-prunes after the bound element is removed", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const runtime = getControllerRuntime(controller);
    const element = createMeasuredElement();
    element.setAttribute("tabindex", "2");

    createDraggable({ controller, element, draggableId: "item" });

    expect(runtime.getStaleDomBindingRecordCount()).toBe(1);

    element.remove();
    runtime.pruneDisconnectedDomBindings();

    expect(runtime.getStaleDomBindingRecordCount()).toBe(0);
    expect(element.getAttribute("tabindex")).toBe("2");

    document.body.append(element);
    dispatchPointerDown(element, { pointerId: 1 });
    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("does not suppress a quick button-handle click before drag activation", () => {
    controller = createDragController({
      pointerConfiguration: { activationDistance: 5 },
    });
    const element = createMeasuredElement();
    const button = document.createElement("button");
    button.dataset.dndDragHandle = "true";
    element.append(button);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    createDraggable({ controller, element, draggableId: "item" });

    dispatchPointerDown(button, { pointerId: 1 });
    dispatchPointerUp(button, { pointerId: 1 });
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("suppresses exactly one related click after pointer drag activation", () => {
    const raf = installMockRaf();
    controller = createDragController({
      pointerConfiguration: { activationDistance: 5 },
    });
    const element = createMeasuredElement();
    const button = document.createElement("button");
    button.dataset.dndDragHandle = "true";
    element.append(button);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    createDraggable({ controller, element, draggableId: "item" });

    dispatchPointerDown(button, { pointerId: 1 });
    dispatchPointerMove(button, { pointerId: 1, clientX: 10 });
    dispatchPointerUp(button, { pointerId: 1, clientX: 10 });
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );
    button.click();

    expect(onClick).toHaveBeenCalledTimes(3);
    raf.restore();
  });

  it("does not retain click suppression after pointer cancellation", () => {
    controller = createDragController({
      pointerConfiguration: { activationDistance: 5 },
    });
    const element = createMeasuredElement();
    const button = document.createElement("button");
    button.dataset.dndDragHandle = "true";
    element.append(button);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    createDraggable({ controller, element, draggableId: "item" });

    dispatchPointerDown(button, { pointerId: 1 });
    dispatchPointerMove(button, { pointerId: 1, clientX: 10 });
    dispatchPointerCancel(button, { pointerId: 1 });
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("releases click suppression when no related click arrives in the turn", () => {
    vi.useFakeTimers();
    controller = createDragController({
      pointerConfiguration: { activationDistance: 5 },
    });
    const element = createMeasuredElement();
    const button = document.createElement("button");
    button.dataset.dndDragHandle = "true";
    element.append(button);
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    createDraggable({ controller, element, draggableId: "item" });

    dispatchPointerDown(button, { pointerId: 1 });
    dispatchPointerMove(button, { pointerId: 1, clientX: 10 });
    dispatchPointerUp(button, { pointerId: 1, clientX: 10 });
    vi.runOnlyPendingTimers();
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );

    expect(onClick).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

function createMeasuredElement(): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubBoundingClientRect(element, createRect({ width: 20, height: 20 }));
  return element;
}
