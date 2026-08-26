import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDragController,
  createDraggable,
  domPointerDragActiveAttribute,
  type DragController,
} from "../src/index.js";
import { getControllerRuntime } from "../src/controller/controller-internals.js";
import {
  createRect,
  dispatchKeyDown,
  dispatchPointerCancel,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("active pointer drag document state", () => {
  const controllers: DragController[] = [];

  afterEach(() => {
    for (const controller of controllers) {
      getControllerRuntime(controller).releaseActiveDragResources();
    }

    controllers.length = 0;
    document.documentElement.removeAttribute(domPointerDragActiveAttribute);
    document.documentElement.style.userSelect = "";
    document.body.style.userSelect = "";
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("marks immediate pointer activation and releases on no-target drop", () => {
    const controller = track(createDragController());
    const source = createSource();

    startPointerDrag(controller, source);

    expectActive(document);
    dispatchPointerUp(window, { pointerId: 1 });
    expectInactive(document);
  });

  it("does not mark pending distance activation and marks once activated", () => {
    const controller = track(
      createDragController({
        pointerConfiguration: { activationDistance: 10 },
      }),
    );
    const source = createSource();

    startPointerDrag(controller, source);
    expectInactive(document);

    dispatchPointerMove(window, { pointerId: 1, clientX: 9 });
    expectInactive(document);

    dispatchPointerMove(window, { pointerId: 1, clientX: 10 });
    expectActive(document);
  });

  it("does not mark pending delay activation and marks once activated", () => {
    vi.useFakeTimers();
    const controller = track(
      createDragController({
        pointerConfiguration: { activationDelay: 100 },
      }),
    );
    const source = createSource();

    startPointerDrag(controller, source);
    expectInactive(document);

    vi.advanceTimersByTime(99);
    expectInactive(document);

    vi.advanceTimersByTime(1);
    expectActive(document);
  });

  it("never marks a canceled pending activation", () => {
    vi.useFakeTimers();
    const controller = track(
      createDragController({
        pointerConfiguration: { activationDelay: 100 },
      }),
    );
    const source = createSource();

    startPointerDrag(controller, source);
    dispatchPointerCancel(window, { pointerId: 1 });
    vi.advanceTimersByTime(100);

    expectInactive(document);
  });

  it("never marks keyboard dragging, including Escape cancellation", () => {
    const controller = track(createDragController());
    const source = createSource();
    createDraggable({ controller, element: source, draggableId: "item" });

    dispatchKeyDown(source, "Space");
    expectInactive(document);

    dispatchKeyDown(window, "Escape");
    expectInactive(document);
  });

  it("releases before drop lifecycle callbacks and manual overlay release", () => {
    const observedStates: Array<string | null> = [];
    const controller = track(
      createDragController({
        overlayRelease: "manual",
        dragOverlay: ({ phase }) => {
          if (phase === "released") {
            observedStates.push(
              document.documentElement.getAttribute(
                domPointerDragActiveAttribute,
              ),
            );
          }

          const overlay = document.createElement("div");
          overlay.dataset.testOverlayPhase = phase;
          return overlay;
        },
        onDragEnd: () => {
          observedStates.push(
            document.documentElement.getAttribute(
              domPointerDragActiveAttribute,
            ),
          );
        },
      }),
    );
    const source = createSource();

    startPointerDrag(controller, source);
    dispatchPointerUp(window, { pointerId: 1 });

    expect(observedStates).toEqual([null, null]);
    expectInactive(document);
    expect(
      document.querySelector('[data-test-overlay-phase="released"]'),
    ).not.toBeNull();
  });

  it("releases for dropped and invalid-target results", () => {
    for (const result of ["dropped", "invalid-target"] as const) {
      const raf = installMockRaf();
      const observedStates: Array<string | null> = [];
      const controller = track(
        createDragController({
          onDragEnd: (event) => {
            expect(event.result).toBe(result);
            observedStates.push(
              document.documentElement.getAttribute(
                domPointerDragActiveAttribute,
              ),
            );
          },
        }),
      );
      const runtime = getControllerRuntime(controller);
      const source = createSource();
      const target = createSource(100);
      runtime.registerDropTarget("target", target, "items");

      startPointerDrag(controller, source);
      dispatchPointerMove(window, {
        pointerId: 1,
        clientX: 110,
        clientY: 10,
      });
      raf.flush();

      if (result === "invalid-target") {
        target.remove();
      }

      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
      expect(observedStates).toEqual([null]);
      expectInactive(document);
      raf.restore();
    }
  });

  it("releases on cancel, pointer cancel, and forced active-resource cleanup", () => {
    const releases = [
      (controller: DragController) => controller.cancelDrag(),
      () => dispatchPointerCancel(window, { pointerId: 1 }),
      (controller: DragController) =>
        getControllerRuntime(controller).releaseActiveDragResources(),
    ];

    for (const release of releases) {
      const controller = track(createDragController());
      const source = createSource();
      startPointerDrag(controller, source);
      expectActive(document);

      release(controller);
      expectInactive(document);
    }
  });

  it("releases after activation and drag-end failures", () => {
    const startError = new Error("start failed");
    const startController = track(
      createDragController({
        onDragStart: () => {
          throw startError;
        },
      }),
    );

    expect(() => {
      startPointerDrag(startController, createSource());
    }).toThrow(startError);
    expectInactive(document);

    const endError = new Error("end failed");
    const endController = track(
      createDragController({
        onDragEnd: () => {
          throw endError;
        },
      }),
    );
    startPointerDrag(endController, createSource());
    expectActive(document);

    expect(() => {
      endController.cancelDrag();
    }).toThrow(endError);
    expectInactive(document);
  });

  it("keeps a shared document marked until the final runtime releases", () => {
    document.documentElement.setAttribute(
      domPointerDragActiveAttribute,
      "pre-existing",
    );
    const first = track(createDragController());
    const second = track(createDragController());

    startPointerDrag(first, createSource(), 1);
    startPointerDrag(second, createSource(), 2);
    expectActive(document);

    getControllerRuntime(first).releaseActiveDragResources();
    expectActive(document);

    getControllerRuntime(first).releaseActiveDragResources();
    expectActive(document);

    getControllerRuntime(second).releaseActiveDragResources();
    expect(
      document.documentElement.getAttribute(domPointerDragActiveAttribute),
    ).toBe("pre-existing");
  });

  it("uses the initiating iframe document and its window resources", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    expect(frameDocument).not.toBeNull();
    expect(frameWindow).not.toBeNull();

    const controller = track(createDragController());
    const source = createSource(0, frameDocument ?? undefined);
    startPointerDrag(controller, source);

    expectInactive(document);
    expectActive(frameDocument ?? document);
    expect(frameDocument?.documentElement.style.userSelect).toBe("none");

    dispatchFramePointerEvent(frameWindow ?? window, "pointerup", 1);

    expectInactive(frameDocument ?? document);
    expect(frameDocument?.documentElement.style.userSelect).toBe("");
  });

  it("lets consumer CSS override explicit descendant cursors and restores them", () => {
    const style = document.createElement("style");
    style.textContent = `
      .editor-text { cursor: text; }
      :root[${domPointerDragActiveAttribute}="true"],
      :root[${domPointerDragActiveAttribute}="true"] *,
      :root[${domPointerDragActiveAttribute}="true"] *::before,
      :root[${domPointerDragActiveAttribute}="true"] *::after {
        cursor: grabbing !important;
      }
    `;
    document.head.append(style);
    const editorText = createSource();
    editorText.className = "editor-text";
    const controller = track(createDragController());

    expect(getComputedStyle(editorText).cursor).toBe("text");
    startPointerDrag(controller, editorText);
    expect(getComputedStyle(editorText).cursor).toBe("grabbing");

    controller.cancelDrag();
    expect(getComputedStyle(editorText).cursor).toBe("text");
    style.remove();
  });

  function track(controller: DragController): DragController {
    controllers.push(controller);
    return controller;
  }
});

function createSource(
  left = 0,
  sourceDocument: Document = document,
): HTMLElement {
  const source = sourceDocument.createElement("div");
  sourceDocument.body.append(source);
  stubBoundingClientRect(source, createRect({ left, width: 20, height: 20 }));
  return source;
}

function startPointerDrag(
  controller: DragController,
  source: HTMLElement,
  pointerId = 1,
): void {
  getControllerRuntime(controller).requestDragStart({
    draggableId: `item-${pointerId}`,
    group: "items",
    element: source,
    pointerId,
    pointerPosition: { x: 0, y: 0 },
  });
}

function expectActive(sourceDocument: Document): void {
  expect(
    sourceDocument.documentElement.getAttribute(domPointerDragActiveAttribute),
  ).toBe("true");
}

function expectInactive(sourceDocument: Document): void {
  expect(
    sourceDocument.documentElement.hasAttribute(domPointerDragActiveAttribute),
  ).toBe(false);
}

function dispatchFramePointerEvent(
  targetWindow: Window & typeof globalThis,
  type: "pointerup" | "pointercancel",
  pointerId: number,
): void {
  const event = new targetWindow.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  targetWindow.dispatchEvent(event);
}
