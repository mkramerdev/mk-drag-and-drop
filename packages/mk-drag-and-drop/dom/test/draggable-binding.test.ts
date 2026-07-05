import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  type DragController,
} from "../src/index.js";
import {
  createRect,
  dispatchKeyDown,
  dispatchPointerDown,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("createDraggable", () => {
  let controller: DragController | null = null;

  afterEach(() => {
    controller?.dispose();
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
        pointerPosition: { x: 4, y: 5 },
        sourceRect: createRect({ width: 20, height: 20 }),
      },
      expect.any(Object),
    );
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
    const element = createMeasuredElement();

    createDraggable({ controller, element, draggableId: "item" });

    expect(element.hasAttribute("tabindex")).toBe(false);

    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("removes listeners and restores DOM state when the controller is disposed", () => {
    const onDragStart = vi.fn();
    controller = createDragController({ onDragStart });
    const element = createMeasuredElement();
    element.setAttribute("tabindex", "2");

    createDraggable({ controller, element, draggableId: "item" });
    controller.dispose();

    expect(element.getAttribute("tabindex")).toBe("2");

    dispatchPointerDown(element, { pointerId: 1 });
    dispatchKeyDown(element, "Space");

    expect(onDragStart).not.toHaveBeenCalled();
  });
});

function createMeasuredElement(): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  stubBoundingClientRect(element, createRect({ width: 20, height: 20 }));
  return element;
}
