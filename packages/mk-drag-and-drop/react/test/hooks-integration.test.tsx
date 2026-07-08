import { StrictMode, useContext, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DragRuntimeScope } from "@mk-drag-and-drop/dom/integration";
import {
  DragProvider,
  useDragHandle,
  useDropContainer,
  useDraggable,
  useDroppable,
  useRemeasureDropTargets,
  useRemeasureOverlay,
  useSortable,
  type SortableDropPlacement,
} from "../src/index.js";
import { DragContext } from "../src/drag-context.js";
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

type RuntimeSpyMap = {
  registerDropTarget?: DragRuntimeScope["registerDropTarget"];
  unregisterDropTarget?: DragRuntimeScope["unregisterDropTarget"];
  registerDropContainer?: DragRuntimeScope["registerDropContainer"];
  unregisterDropContainer?: DragRuntimeScope["unregisterDropContainer"];
  setOverlayRect?: DragRuntimeScope["setOverlayRect"];
};

function createRuntimeSpyInstaller(
  spies: RuntimeSpyMap,
): (runtime: DragRuntimeScope) => void {
  let installed = false;

  return (runtime) => {
    if (installed) {
      return;
    }

    installed = true;

    if (spies.registerDropTarget) {
      const registerDropTarget = runtime.registerDropTarget;
      runtime.registerDropTarget = ((
        ...args: Parameters<DragRuntimeScope["registerDropTarget"]>
      ) => {
        spies.registerDropTarget?.(...args);
        registerDropTarget(...args);
      }) as DragRuntimeScope["registerDropTarget"];
    }

    if (spies.unregisterDropTarget) {
      const unregisterDropTarget = runtime.unregisterDropTarget;
      runtime.unregisterDropTarget = ((
        ...args: Parameters<DragRuntimeScope["unregisterDropTarget"]>
      ) => {
        spies.unregisterDropTarget?.(...args);
        unregisterDropTarget(...args);
      }) as DragRuntimeScope["unregisterDropTarget"];
    }

    if (spies.registerDropContainer) {
      const registerDropContainer = runtime.registerDropContainer;
      runtime.registerDropContainer = ((
        ...args: Parameters<DragRuntimeScope["registerDropContainer"]>
      ) => {
        spies.registerDropContainer?.(...args);
        registerDropContainer(...args);
      }) as DragRuntimeScope["registerDropContainer"];
    }

    if (spies.unregisterDropContainer) {
      const unregisterDropContainer = runtime.unregisterDropContainer;
      runtime.unregisterDropContainer = ((
        ...args: Parameters<DragRuntimeScope["unregisterDropContainer"]>
      ) => {
        spies.unregisterDropContainer?.(...args);
        unregisterDropContainer(...args);
      }) as DragRuntimeScope["unregisterDropContainer"];
    }

    if (spies.setOverlayRect) {
      const setOverlayRect = runtime.setOverlayRect;
      runtime.setOverlayRect = ((
        ...args: Parameters<DragRuntimeScope["setOverlayRect"]>
      ) => {
        spies.setOverlayRect?.(...args);
        setOverlayRect(...args);
      }) as DragRuntimeScope["setOverlayRect"];
    }
  };
}

function RuntimeSpyProbe({
  install,
}: {
  install: (runtime: DragRuntimeScope) => void;
}) {
  const context = useContext(DragContext);

  if (context) {
    install(context.runtime);
  }

  return null;
}

describe("React hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when hooks are used outside DragProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<UseDraggableOutside />)).toThrow(
      "useDraggable must be used inside DragProvider",
    );
    expect(() => render(<UseDroppableOutside />)).toThrow(
      "useDroppable must be used inside DragProvider",
    );
    expect(() => render(<UseDropContainerOutside />)).toThrow(
      "useDropContainer must be used inside DragProvider",
    );
    expect(() => render(<UseSortableOutside />)).toThrow(
      "useSortable must be used inside DragProvider",
    );
    expect(() => render(<UseRemeasureOutside />)).toThrow(
      "useRemeasureDropTargets must be used inside DragProvider",
    );
    expect(() => render(<UseRemeasureOverlayOutside />)).toThrow(
      "useRemeasureOverlay must be used inside DragProvider",
    );

    consoleError.mockRestore();
  });

  it("useRemeasureOverlay returns a safe no-op without mounted overlay", () => {
    let remeasureOverlay: (() => void) | null = null;

    render(
      <DragProvider>
        <RemeasureOverlayProbe
          onRemeasureOverlay={(nextRemeasureOverlay) => {
            remeasureOverlay = nextRemeasureOverlay;
          }}
        />
      </DragProvider>,
    );

    const currentRemeasureOverlay = remeasureOverlay;
    expect(currentRemeasureOverlay).toEqual(expect.any(Function));
    expect(() => currentRemeasureOverlay?.()).not.toThrow();
  });

  it("useRemeasureOverlay remeasures mounted overlay content", () => {
    let remeasureOverlay: (() => void) | null = null;
    let getBoundingClientRect: ReturnType<typeof vi.fn> | null = null;
    const setOverlayRect = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({ setOverlayRect });

    render(
      <DragProvider
        dragOverlay={() => (
          <div
            data-testid="overlay"
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
        )}
      >
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <RemeasureOverlayProbe
          onRemeasureOverlay={(nextRemeasureOverlay) => {
            remeasureOverlay = nextRemeasureOverlay;
          }}
        />
        <DraggableWithChild />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(setOverlayRect).toHaveBeenLastCalledWith(
      createRect({ width: 20, height: 20 }),
    );

    const currentRemeasureOverlay = remeasureOverlay;
    if (!currentRemeasureOverlay) {
      throw new Error("Expected overlay remeasurement callback");
    }

    act(() => {
      currentRemeasureOverlay();
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
    expect(setOverlayRect).toHaveBeenLastCalledWith(
      createRect({ width: 40, height: 30 }),
    );
  });

  it("hook result types support non-div host elements", () => {
    render(
      <DragProvider>
        <NonDivHookTypes />
      </DragProvider>,
    );

    expect(screen.getByText("Article")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Button" })).toBeInTheDocument();
  });

  it("useDroppable registers and unregisters on callback ref changes", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
      unregisterDropTarget: unregisterSpy,
    });
    const { rerender, unmount } = render(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicDroppable dropTargetId="target-1" />
      </DragProvider>,
    );
    const element = screen.getByTestId("droppable");

    rerender(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicDroppable dropTargetId="target-2" />
      </DragProvider>,
    );
    unmount();

    expect(registerSpy).toHaveBeenCalledTimes(2);
    expect(registerSpy).toHaveBeenCalledWith(
      "target-1",
      element,
      "items",
      { containerId: null },
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "target-2",
      element,
      "items",
      { containerId: null },
    );
    expect(unregisterSpy).toHaveBeenCalledTimes(2);
    expect(unregisterSpy).toHaveBeenCalledWith(
      "target-1",
      element,
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "target-2",
      element,
    );
  });

  it("useDroppable passes container metadata through", () => {
    const registerSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
    });

    render(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicDroppable dropTargetId="target-1" containerId="bucket-1" />
      </DragProvider>,
    );
    const element = screen.getByTestId("droppable");

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(
      "target-1",
      element,
      "items",
      { containerId: "bucket-1" },
    );
  });

  it("useDropContainer registers and unregisters on callback ref changes", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropContainer: registerSpy,
      unregisterDropContainer: unregisterSpy,
    });
    const { rerender, unmount } = render(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicDropContainer containerId="container-1" />
      </DragProvider>,
    );
    const element = screen.getByTestId("drop-container");

    rerender(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicDropContainer containerId="container-2" />
      </DragProvider>,
    );
    unmount();

    expect(registerSpy).toHaveBeenCalledTimes(2);
    expect(registerSpy).toHaveBeenCalledWith(
      "container-1",
      element,
      "items",
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "container-2",
      element,
      "items",
    );
    expect(unregisterSpy).toHaveBeenCalledTimes(2);
    expect(unregisterSpy).toHaveBeenCalledWith(
      "container-1",
      element,
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "container-2",
      element,
    );
  });

  it("useDropContainer returns a stable result when options do not change", () => {
    const results: Array<ReturnType<typeof useDropContainer>> = [];
    const { rerender } = render(
      <DragProvider>
        <DropContainerIdentityProbe results={results} />
      </DragProvider>,
    );

    rerender(
      <DragProvider>
        <DropContainerIdentityProbe results={results} />
      </DragProvider>,
    );

    expect(results).toHaveLength(2);
    expect(results[1]).toBe(results[0]);
  });

  it("ref cleanup works under React StrictMode", () => {
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      unregisterDropTarget: unregisterSpy,
    });
    const { unmount } = render(
      <StrictMode>
        <DragProvider>
          <RuntimeSpyProbe install={installRuntimeSpies} />
          <DynamicDroppable dropTargetId="target-1" />
        </DragProvider>
      </StrictMode>,
    );

    unmount();

    expect(unregisterSpy).toHaveBeenCalledWith(
      "target-1",
      expect.any(HTMLElement),
    );
  });

  it("drop container ref cleanup works under React StrictMode", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropContainer: registerSpy,
      unregisterDropContainer: unregisterSpy,
    });
    const { unmount } = render(
      <StrictMode>
        <DragProvider>
          <RuntimeSpyProbe install={installRuntimeSpies} />
          <DynamicDropContainer containerId="container-1" />
        </DragProvider>
      </StrictMode>,
    );

    unmount();

    expect(registerSpy).toHaveBeenCalled();
    expect(registerSpy).toHaveBeenCalledTimes(unregisterSpy.mock.calls.length);
    expect(unregisterSpy).toHaveBeenCalledWith(
      "container-1",
      expect.any(HTMLElement),
    );
  });

  it("useSortable registers, unregisters, and supports pointer drag handles", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
      unregisterDropTarget: unregisterSpy,
    });
    const onDragStart = vi.fn();
    const { unmount } = render(
      <DragProvider onDragStart={onDragStart}>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <SortableWithHandle />
      </DragProvider>,
    );
    const row = screen.getByTestId("sortable");
    const handle = screen.getByRole("button", { name: "Drag item" });
    stubBoundingClientRect(row, createRect({ width: 20, height: 20 }));

    act(() => {
      dispatchPointerDown(row, { pointerId: 1 });
    });
    expect(onDragStart).not.toHaveBeenCalled();

    act(() => {
      dispatchPointerDown(handle, { pointerId: 2 });
    });
    expect(onDragStart).toHaveBeenCalledTimes(1);

    unmount();

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(
      "item-1",
      row,
      "items",
      {
        containerId: "container-1",
        sortable: true,
        sortableAxis: "vertical",
      },
    );
    expect(unregisterSpy).toHaveBeenCalledTimes(1);
    expect(unregisterSpy).toHaveBeenCalledWith(
      "item-1",
      row,
    );
  });

  it("useSortable starts drag and registers the target under React StrictMode", () => {
    const registerSpy = vi.fn();
    const onDragStart = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
    });

    render(
      <StrictMode>
        <DragProvider onDragStart={onDragStart}>
          <RuntimeSpyProbe install={installRuntimeSpies} />
          <SortableWithHandle />
        </DragProvider>
      </StrictMode>,
    );
    const row = screen.getByTestId("sortable");
    const handle = screen.getByRole("button", { name: "Drag item" });
    stubBoundingClientRect(row, createRect({ width: 20, height: 20 }));

    act(() => {
      dispatchPointerDown(handle, { pointerId: 1 });
    });

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "item-1", source: "pointer" }),
      expect.any(Object),
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "item-1",
      row,
      "items",
      {
        containerId: "container-1",
        sortable: true,
        sortableAxis: "vertical",
      },
    );
  });

  it("useSortable ref cleanup works under React StrictMode", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
      unregisterDropTarget: unregisterSpy,
    });
    const { unmount } = render(
      <StrictMode>
        <DragProvider>
          <RuntimeSpyProbe install={installRuntimeSpies} />
          <SortableWithHandle />
        </DragProvider>
      </StrictMode>,
    );

    unmount();

    expect(registerSpy).toHaveBeenCalled();
    expect(registerSpy).toHaveBeenCalledTimes(unregisterSpy.mock.calls.length);
    expect(unregisterSpy).toHaveBeenCalledWith(
      "item-1",
      expect.any(HTMLElement),
    );
  });

  it("useSortable rerender with changed ids, groups, and containers updates registration", () => {
    const registerSpy = vi.fn();
    const unregisterSpy = vi.fn();
    const installRuntimeSpies = createRuntimeSpyInstaller({
      registerDropTarget: registerSpy,
      unregisterDropTarget: unregisterSpy,
    });
    const { rerender, unmount } = render(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicSortable
          draggableId="item-1"
          group="items"
          containerId="container-1"
        />
      </DragProvider>,
    );
    const element = screen.getByTestId("dynamic-sortable");

    rerender(
      <DragProvider>
        <RuntimeSpyProbe install={installRuntimeSpies} />
        <DynamicSortable
          draggableId="item-2"
          group="other-items"
          containerId="container-2"
        />
      </DragProvider>,
    );
    unmount();

    expect(registerSpy).toHaveBeenCalledWith(
      "item-1",
      element,
      "items",
      {
        containerId: "container-1",
        sortable: true,
        sortableAxis: "vertical",
      },
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "item-2",
      element,
      "other-items",
      {
        containerId: "container-2",
        sortable: true,
        sortableAxis: "vertical",
      },
    );
    expect(unregisterSpy).toHaveBeenCalledWith("item-1", element);
    expect(unregisterSpy).toHaveBeenCalledWith("item-2", element);
  });
});

describe("React integration flows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pointer drag to droppable calls lifecycle callbacks in order", () => {
    const raf = installMockRaf();
    const calls: string[] = [];
    render(
      <DragProvider
        onDragStart={({ draggableId }) => calls.push(`start:${draggableId}`)}
        onDragUpdate={({ activeDropTargetId }) =>
          calls.push(`update:${activeDropTargetId}`)
        }
        onDragEnd={({ dropTargetId }) => calls.push(`end:${dropTargetId}`)}
        onDrop={({ draggableId, dropTargetId }) =>
          calls.push(`drop:${draggableId}:${dropTargetId}`)
        }
      >
        <DraggableWithChild />
        <DynamicDroppable dropTargetId="target-1" />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("droppable"),
      createRect({ left: 100, width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(calls).toEqual([
      "start:item-1",
      "update:target-1",
      "end:target-1",
      "drop:item-1:target-1",
    ]);
    raf.restore();
  });

  it("StrictMode droppable target is active on update and drop", () => {
    const raf = installMockRaf();
    const onDragUpdate = vi.fn();
    const onDrop = vi.fn();

    render(
      <StrictMode>
        <DragProvider onDragUpdate={onDragUpdate} onDrop={onDrop}>
          <DraggableWithChild />
          <DynamicDroppable dropTargetId="target-1" />
        </DragProvider>
      </StrictMode>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("droppable"),
      createRect({ left: 100, width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(onDragUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDropTargetId: "target-1",
        source: "pointer",
      }),
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item-1", source: "pointer", dropTargetId: "target-1" },
      expect.any(Object),
    );
    raf.restore();
  });

  it("invalid pointer drop does not call onDrop", () => {
    const onDrop = vi.fn();
    render(
      <DragProvider onDrop={onDrop}>
        <DraggableWithChild />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
      dispatchPointerUp(window, { pointerId: 1 });
    });

    expect(onDrop).not.toHaveBeenCalled();
  });

  it("unmounting a droppable leaves no valid stale target", () => {
    const raf = installMockRaf();
    const onDrop = vi.fn();
    const { rerender } = render(
      <DragProvider onDrop={onDrop}>
        <DraggableWithChild />
        <DynamicDroppable dropTargetId="target-1" />
      </DragProvider>,
    );
    const removedTarget = screen.getByTestId("droppable");

    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      removedTarget,
      createRect({ left: 100, width: 20, height: 20 }),
    );

    rerender(
      <DragProvider onDrop={onDrop}>
        <DraggableWithChild />
      </DragProvider>,
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(onDrop).not.toHaveBeenCalled();
    raf.restore();
  });

  it("keyboard drag starts, moves, drops, and cancels", () => {
    const raf = installMockRaf();
    const onDragStart = vi.fn();
    const onDrop = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <DragProvider
        onDragStart={onDragStart}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <DraggableWithChild />
        <DynamicDroppable dropTargetId="target-1" />
      </DragProvider>,
    );
    const source = screen.getByTestId("draggable");
    stubBoundingClientRect(source, createRect({ width: 20, height: 20 }));
    stubBoundingClientRect(
      screen.getByTestId("droppable"),
      createRect({ top: 20, width: 20, height: 20 }),
    );

    act(() => {
      source.focus();
      dispatchKeyDown(source, "Space");
      dispatchKeyDown(window, "ArrowDown");
      raf.flush();
      dispatchKeyDown(window, "Enter");
    });

    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ draggableId: "item-1", source: "keyboard" }),
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item-1", source: "keyboard", dropTargetId: "target-1" },
      expect.any(Object),
    );

    onDragStart.mockClear();
    onDrop.mockClear();
    onDragEnd.mockClear();

    act(() => {
      dispatchKeyDown(source, "Space");
      dispatchKeyDown(window, "Escape");
    });

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "keyboard",
        result: "canceled",
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
    raf.restore();
  });

  it("interactive children do not start drags accidentally", () => {
    const onDragStart = vi.fn();
    render(
      <DragProvider onDragStart={onDragStart}>
        <DraggableWithChild />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByRole("button", { name: "Edit" }), {
        pointerId: 1,
      });
    });

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("announcements update from lifecycle callbacks", () => {
    render(
      <DragProvider
        announcements={{
          onDragStart: ({ draggableId, source }) =>
            `Started ${draggableId} by ${source}`,
        }}
      >
        <DraggableWithChild />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
    });

    expect(screen.getByText("Started item-1 by pointer")).toBeInTheDocument();
  });

  it("pointercancel cancels a React drag without dropping", () => {
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    render(
      <DragProvider onDragEnd={onDragEnd} onDrop={onDrop}>
        <DraggableWithChild />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), { pointerId: 1 });
      dispatchPointerCancel(window, { pointerId: 1 });
    });

    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "canceled",
        overlayRect: null,
        dropTargetId: null,
      },
      expect.any(Object),
    );
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("moves Kanban-style cards across two containers", () => {
    const raf = installMockRaf();
    render(<KanbanBoard />);
    const cardA = screen.getByTestId("card-a");
    const cardB = screen.getByTestId("card-b");
    const rightColumn = screen.getByTestId("column-body-right");
    stubBoundingClientRect(cardA, createRect({ left: 0, width: 50, height: 20 }));
    stubBoundingClientRect(
      cardB,
      createRect({ left: 100, width: 50, height: 20 }),
    );
    stubBoundingClientRect(
      rightColumn,
      createRect({ left: 100, width: 50, height: 200 }),
    );

    act(() => {
      dispatchPointerDown(cardA, { pointerId: 1 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 18 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 18 });
    });

    expect(
      Array.from(rightColumn.querySelectorAll("[data-testid^='card-']")).map(
        (element) => element.getAttribute("data-testid"),
      ),
    ).toEqual(["card-b", "card-a"]);
    raf.restore();
  });

  it("updates sortable final order through React state on drop", () => {
    const raf = installMockRaf();
    render(<StatefulSortableList />);
    const list = screen.getByTestId("stateful-sortable-list");
    const a = screen.getByTestId("stateful-sortable-a");
    const b = screen.getByTestId("stateful-sortable-b");
    stubBoundingClientRect(a, createRect({ top: 0, width: 20, height: 20 }));
    stubBoundingClientRect(b, createRect({ top: 30, width: 20, height: 20 }));

    act(() => {
      dispatchPointerDown(a, { pointerId: 1, clientX: 10, clientY: 10 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 40 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 40 });
    });

    expect(
      Array.from(list.children).map((element) =>
        element.getAttribute("data-testid"),
      ),
    ).toEqual(["stateful-sortable-b", "stateful-sortable-a"]);
    raf.restore();
  });

  it("does not reorder an isolated sortable item with no valid targets", () => {
    const raf = installMockRaf();
    render(<StatefulSortableListWithIsolatedItem />);
    const list = screen.getByTestId("isolated-sortable-list");
    const isolated = screen.getByTestId("isolated-sortable-isolated");
    const b = screen.getByTestId("isolated-sortable-b");
    stubBoundingClientRect(
      screen.getByTestId("isolated-sortable-a"),
      createRect({ top: 0, width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      isolated,
      createRect({ top: 30, width: 20, height: 20 }),
    );
    stubBoundingClientRect(b, createRect({ top: 60, width: 20, height: 20 }));

    act(() => {
      dispatchPointerDown(isolated, { pointerId: 1, clientX: 10, clientY: 40 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 70 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 70 });
    });

    expect(
      Array.from(list.children).map((element) =>
        element.getAttribute("data-testid"),
      ),
    ).toEqual([
      "isolated-sortable-a",
      "isolated-sortable-isolated",
      "isolated-sortable-b",
    ]);
    raf.restore();
  });

  it("reorders against the active same-group target when a skipped-group item is closer", () => {
    const raf = installMockRaf();
    render(<StatefulSortableListWithIsolatedItem />);
    const list = screen.getByTestId("isolated-sortable-list");
    const a = screen.getByTestId("isolated-sortable-a");
    stubBoundingClientRect(a, createRect({ top: 0, width: 20, height: 20 }));
    stubBoundingClientRect(
      screen.getByTestId("isolated-sortable-isolated"),
      createRect({ top: 30, width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("isolated-sortable-b"),
      createRect({ top: 60, width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(a, { pointerId: 1, clientX: 10, clientY: 10 });
      dispatchPointerMove(window, { pointerId: 1, clientX: 10, clientY: 45 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 10, clientY: 45 });
    });

    expect(
      Array.from(list.children).map((element) =>
        element.getAttribute("data-testid"),
      ),
    ).toEqual([
      "isolated-sortable-isolated",
      "isolated-sortable-b",
      "isolated-sortable-a",
    ]);
    raf.restore();
  });
});

function UseDraggableOutside() {
  useDraggable({ draggableId: "item-1" });
  return null;
}

function UseDroppableOutside() {
  useDroppable({ dropTargetId: "target-1" });
  return null;
}

function UseDropContainerOutside() {
  useDropContainer({ containerId: "container-1" });
  return null;
}

function UseSortableOutside() {
  useSortable({ draggableId: "item-1" });
  return null;
}

function UseRemeasureOutside() {
  useRemeasureDropTargets();
  return null;
}

function UseRemeasureOverlayOutside() {
  useRemeasureOverlay();
  return null;
}

function RemeasureOverlayProbe({
  onRemeasureOverlay,
}: {
  onRemeasureOverlay: (remeasureOverlay: () => void) => void;
}) {
  const remeasureOverlay = useRemeasureOverlay();

  onRemeasureOverlay(remeasureOverlay);

  return null;
}

function NonDivHookTypes() {
  const articleSortable = useSortable<HTMLArticleElement>({
    draggableId: "article",
  });

  const sectionDroppable = useDroppable<HTMLElement>({
    dropTargetId: "section-target",
  });

  const buttonDraggable = useDraggable<HTMLButtonElement>({
    draggableId: "button",
  });

  const listContainer = useDropContainer<HTMLUListElement>({
    containerId: "list",
  });

  return (
    <section {...sectionDroppable}>
      <article {...articleSortable}>Article</article>
      <button {...buttonDraggable} type="button">
        Button
      </button>
      <ul {...listContainer} />
    </section>
  );
}

function DynamicDroppable({
  dropTargetId,
  containerId,
}: {
  dropTargetId: string;
  containerId?: string | null;
}) {
  const droppable = useDroppable({ dropTargetId, group: "items", containerId });

  return (
    <div {...droppable} data-testid="droppable">
      Drop here
    </div>
  );
}

function DynamicDropContainer({ containerId }: { containerId: string }) {
  const dropContainer = useDropContainer({ containerId, group: "items" });

  return (
    <div {...dropContainer} data-testid="drop-container">
      Drop here
    </div>
  );
}

function DropContainerIdentityProbe({
  results,
}: {
  results: Array<ReturnType<typeof useDropContainer>>;
}) {
  const dropContainer = useDropContainer({
    containerId: "container-1",
    group: "items",
  });

  results.push(dropContainer);

  return (
    <div {...dropContainer} data-testid="drop-container-identity">
      Drop here
    </div>
  );
}

function DraggableWithChild() {
  const draggable = useDraggable({ draggableId: "item-1", group: "items" });

  return (
    <div {...draggable} data-testid="draggable">
      Drag me
      <button type="button">Edit</button>
    </div>
  );
}

function SortableWithHandle() {
  const sortable = useSortable({
    draggableId: "item-1",
    group: "items",
    containerId: "container-1",
    placementBoundary: { start: 0.5, end: 0.5 },
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...sortable} data-testid="sortable">
      <button {...handle} type="button" aria-label="Drag item">
        {"\u22ee\u22ee"}
      </button>
      Item
    </div>
  );
}

function DynamicSortable({
  draggableId,
  group,
  containerId,
}: {
  draggableId: string;
  group: string;
  containerId: string | null;
}) {
  const sortable = useSortable({
    draggableId,
    group,
    containerId,
  });

  return (
    <div {...sortable} data-testid="dynamic-sortable">
      Item {draggableId}
    </div>
  );
}

type KanbanColumnState = {
  id: string;
  title: string;
  cardIds: string[];
};

const kanbanCards: Record<string, string> = {
  a: "First card",
  b: "Second card",
};

function KanbanBoard() {
  const [columns, setColumns] = useState<KanbanColumnState[]>([
    { id: "left", title: "Left", cardIds: ["a"] },
    { id: "right", title: "Right", cardIds: ["b"] },
  ]);

  return (
    <DragProvider
      onDrop={({ draggableId, sortablePlacement }) => {
        const placement = sortablePlacement;

        if (!placement?.containerId) {
          return;
        }

        setColumns((currentColumns) =>
          moveKanbanCard(currentColumns, {
            cardId: draggableId,
            toColumnId: placement.containerId ?? "",
            previousCardId: placement.previousDraggableId,
            nextCardId: placement.nextDraggableId,
          }),
        );
      }}
    >
      {columns.map((column) => (
        <KanbanColumn key={column.id} column={column} />
      ))}
    </DragProvider>
  );
}

function KanbanColumn({ column }: { column: KanbanColumnState }) {
  const columnSortable = useSortable({
    draggableId: column.id,
    group: "kanban-columns",
    containerId: "board",
    axis: "horizontal",
  });
  const cardContainer = useDropContainer({
    containerId: column.id,
    group: "kanban-cards",
  });

  return (
    <section {...columnSortable} data-testid={`column-${column.id}`}>
      <div {...cardContainer} data-testid={`column-body-${column.id}`}>
        {column.cardIds.map((cardId) => (
          <KanbanCard key={cardId} cardId={cardId} columnId={column.id} />
        ))}
      </div>
    </section>
  );
}

function KanbanCard({
  cardId,
  columnId,
}: {
  cardId: string;
  columnId: string;
}) {
  const sortable = useSortable({
    draggableId: cardId,
    group: "kanban-cards",
    containerId: columnId,
  });

  return (
    <article {...sortable} data-testid={`card-${cardId}`}>
      {kanbanCards[cardId]}
    </article>
  );
}

function moveKanbanCard(
  columns: KanbanColumnState[],
  input: {
    cardId: string;
    toColumnId: string;
    previousCardId: string | null;
    nextCardId: string | null;
  },
): KanbanColumnState[] {
  const withoutMovedCard = columns.map((column) => ({
    ...column,
    cardIds: column.cardIds.filter((cardId) => cardId !== input.cardId),
  }));

  return withoutMovedCard.map((column) => {
    if (column.id !== input.toColumnId) {
      return column;
    }

    const cardIds = [...column.cardIds];
    const insertIndex = getKanbanInsertIndex(cardIds, input);
    cardIds.splice(insertIndex, 0, input.cardId);

    return {
      ...column,
      cardIds,
    };
  });
}

function getKanbanInsertIndex(
  cardIds: string[],
  input: {
    previousCardId: string | null;
    nextCardId: string | null;
  },
): number {
  if (input.previousCardId) {
    const previousIndex = cardIds.indexOf(input.previousCardId);

    if (previousIndex !== -1) {
      return previousIndex + 1;
    }
  }

  if (input.nextCardId) {
    const nextIndex = cardIds.indexOf(input.nextCardId);

    if (nextIndex !== -1) {
      return nextIndex;
    }
  }

  return cardIds.length;
}

function StatefulSortableList() {
  const [items, setItems] = useState(["a", "b"]);

  return (
    <DragProvider
      onDrop={({ draggableId, sortablePlacement }) => {
        const placement = sortablePlacement;

        if (!placement) {
          return;
        }

        setItems((currentItems) =>
          moveSortableIdsToPlacement(currentItems, draggableId, placement),
        );
      }}
    >
      <div data-testid="stateful-sortable-list">
        {items.map((draggableId) => (
          <StatefulSortableItem key={draggableId} draggableId={draggableId} />
        ))}
      </div>
    </DragProvider>
  );
}

function StatefulSortableItem({ draggableId }: { draggableId: string }) {
  const sortable = useSortable({
    draggableId,
    group: "stateful-sortable",
  });

  return (
    <div {...sortable} data-testid={`stateful-sortable-${draggableId}`}>
      Item {draggableId}
    </div>
  );
}

function moveSortableIdsToPlacement(
  items: readonly string[],
  draggableId: string,
  placement: SortableDropPlacement,
): string[] {
  const withoutItem = items.filter((item) => item !== draggableId);

  if (placement.targetDraggableId !== null && placement.side !== null) {
    const targetIndex = withoutItem.indexOf(placement.targetDraggableId);

    if (targetIndex === -1) {
      return [...items];
    }

    const insertIndex =
      placement.side === "after" ? targetIndex + 1 : targetIndex;

    return [
      ...withoutItem.slice(0, insertIndex),
      draggableId,
      ...withoutItem.slice(insertIndex),
    ];
  }

  if (placement.previousDraggableId !== null) {
    const previousIndex = withoutItem.indexOf(placement.previousDraggableId);

    if (previousIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, previousIndex + 1),
      draggableId,
      ...withoutItem.slice(previousIndex + 1),
    ];
  }

  if (placement.nextDraggableId !== null) {
    const nextIndex = withoutItem.indexOf(placement.nextDraggableId);

    if (nextIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, nextIndex),
      draggableId,
      ...withoutItem.slice(nextIndex),
    ];
  }

  return [...items];
}

function StatefulSortableListWithIsolatedItem() {
  const [items, setItems] = useState(["a", "isolated", "b"]);

  return (
    <DragProvider
      onDrop={({ draggableId, sortablePlacement }) => {
        const placement = sortablePlacement;

        if (!placement) {
          return;
        }

        setItems((currentItems) =>
          moveSortableIdsToPlacement(currentItems, draggableId, placement),
        );
      }}
    >
      <div data-testid="isolated-sortable-list">
        {items.map((draggableId) => (
          <IsolatedSortableItem key={draggableId} draggableId={draggableId} />
        ))}
      </div>
    </DragProvider>
  );
}

function IsolatedSortableItem({ draggableId }: { draggableId: string }) {
  const sortable = useSortable({
    draggableId,
    group:
      draggableId === "isolated"
        ? "isolated-sortable"
        : "shared-isolated-sortable",
  });

  return (
    <div {...sortable} data-testid={`isolated-sortable-${draggableId}`}>
      Item {draggableId}
    </div>
  );
}
