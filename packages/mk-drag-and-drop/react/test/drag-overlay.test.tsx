import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DragState } from "@mk-drag-and-drop/dom/integration";
import {
  DragOverlayHost,
  type DragOverlayHostHandle,
} from "../src/drag-overlay.js";
import { createRect } from "./test-utils.js";

const dragState: DragState = {
  draggableId: "item-1",
  group: "items",
  sourceRect: createRect({ left: 20, top: 30, width: 40, height: 25 }),
  startPointerPosition: { x: 4, y: 6 },
  pointerPosition: { x: 4, y: 6 },
};

describe("DragOverlayHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes internal remeasurement on the host handle", () => {
    let host: DragOverlayHostHandle | null = null;

    render(
      <DragOverlayHost
        contentId={1}
        dragState={dragState}
        onHostReady={(nextHost) => {
          host = nextHost;
        }}
      >
        <div>Overlay</div>
      </DragOverlayHost>,
    );

    expect(host).toMatchObject({
      move: expect.any(Function),
      remeasure: expect.any(Function),
    });
  });

  it("remeasures the same overlay element used by mount measurement", () => {
    const onOverlayRectChange = vi.fn();
    let host: DragOverlayHostHandle | null = null;
    let getBoundingClientRect: ReturnType<typeof vi.fn> | null = null;

    render(
      <DragOverlayHost
        contentId={1}
        dragState={dragState}
        onHostReady={(nextHost) => {
          host = nextHost;
        }}
        onOverlayRectChange={onOverlayRectChange}
      >
        <div
          ref={(element) => {
            if (element && !getBoundingClientRect) {
              getBoundingClientRect = vi
                .fn()
                .mockReturnValueOnce(
                  createRect({ width: 20, height: 20 }) as DOMRect,
                )
                .mockReturnValue(
                  createRect({ width: 40, height: 30 }) as DOMRect,
                );
              vi.spyOn(element, "getBoundingClientRect").mockImplementation(
                getBoundingClientRect,
              );
            }
          }}
        >
          Overlay
        </div>
      </DragOverlayHost>,
    );

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(onOverlayRectChange).toHaveBeenLastCalledWith(
      createRect({ width: 20, height: 20 }),
    );

    const currentHost = host;
    if (!currentHost) {
      throw new Error("Expected overlay host handle");
    }

    act(() => {
      currentHost.remeasure();
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
    expect(onOverlayRectChange).toHaveBeenLastCalledWith(
      createRect({ width: 40, height: 30 }),
    );
  });

  it("does not throw when a stale host handle is remeasured after unmount", () => {
    let host: DragOverlayHostHandle | null = null;
    const { unmount } = render(
      <DragOverlayHost
        contentId={1}
        dragState={dragState}
        onHostReady={(nextHost) => {
          host = nextHost;
        }}
      >
        <div>Overlay</div>
      </DragOverlayHost>,
    );

    const staleHost = host;
    if (!staleHost) {
      throw new Error("Expected overlay host handle");
    }

    unmount();

    expect(() => staleHost.remeasure()).not.toThrow();
  });
});