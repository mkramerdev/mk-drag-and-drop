import { act, render, screen } from "@testing-library/react";
import {
  StrictMode,
  Suspense,
  startTransition,
  useContext,
  useState,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DragRuntimeHandle } from "@mk-drag-and-drop/dom/integration";
import {
  DragProvider,
  useDraggable,
  useDroppable,
} from "../src/index.js";
import { DragContext } from "../src/drag-context.js";
import {
  createRect,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

function createCleanupSpyInstaller(
  spy: () => void,
): (runtime: DragRuntimeHandle) => void {
  let installed = false;

  return (runtime) => {
    if (installed) {
      return;
    }

    installed = true;
    const cleanup = runtime.cleanup;
    runtime.cleanup = () => {
      spy();
      cleanup();
    };
  };
}

function createConfigureSpyInstaller(
  spy: DragRuntimeHandle["configure"],
): (runtime: DragRuntimeHandle) => void {
  let installed = false;

  return (runtime) => {
    if (installed) {
      return;
    }

    installed = true;
    const configure = runtime.configure;
    runtime.configure = ((...args) => {
      spy(...args);
      configure(...args);
    }) as DragRuntimeHandle["configure"];
  };
}

describe("DragProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not configure the runtime during initial render", () => {
    const renderPhaseKeyboardEnabled: boolean[] = [];
    let runtime: DragRuntimeHandle | null = null;

    render(
      <DragProvider keyboardConfiguration={{ enabled: false }}>
        <RuntimeProbe
          onRuntime={(nextRuntime) => {
            runtime = nextRuntime;
            renderPhaseKeyboardEnabled.push(
              nextRuntime.isKeyboardDragEnabled(),
            );
          }}
        />
        <DraggableBox />
      </DragProvider>,
    );

    expect(renderPhaseKeyboardEnabled).toEqual([true]);
    expect(runtime?.isKeyboardDragEnabled()).toBe(false);
    expect(screen.getByTestId("draggable")).not.toHaveAttribute("tabindex");
  });

  it("does not call runtime configure during rerender", () => {
    const configureSpy = vi.fn();
    const installConfigureSpy = createConfigureSpyInstaller(configureSpy);
    const renderPhaseConfigureCallCounts: number[] = [];

    const { rerender } = render(
      <DragProvider>
        <RuntimeProbe
          onRuntime={(runtime) => {
            installConfigureSpy(runtime);
            renderPhaseConfigureCallCounts.push(configureSpy.mock.calls.length);
          }}
        />
        <DraggableBox />
      </DragProvider>,
    );

    expect(renderPhaseConfigureCallCounts).toEqual([0]);
    expect(configureSpy).toHaveBeenCalledTimes(1);

    configureSpy.mockClear();
    renderPhaseConfigureCallCounts.length = 0;

    rerender(
      <DragProvider pointerConfiguration={{ activationDistance: 8 }}>
        <RuntimeProbe
          onRuntime={(runtime) => {
            installConfigureSpy(runtime);
            renderPhaseConfigureCallCounts.push(configureSpy.mock.calls.length);
          }}
        />
        <DraggableBox />
      </DragProvider>,
    );

    expect(renderPhaseConfigureCallCounts).toEqual([0]);
    expect(configureSpy).toHaveBeenCalledTimes(1);
  });

  it("updates runtime config on rerender", () => {
    const { rerender } = render(
      <DragProvider keyboardConfiguration={{ enabled: false }}>
        <DraggableBox />
      </DragProvider>,
    );

    expect(screen.getByTestId("draggable")).not.toHaveAttribute("tabindex");

    rerender(
      <DragProvider keyboardConfiguration={{ enabled: true }}>
        <DraggableBox />
      </DragProvider>,
    );

    expect(screen.getByTestId("draggable")).toHaveAttribute("tabindex", "0");
  });

  it("keeps lifecycle callbacks current without reconfiguring unchanged runtime settings", () => {
    const configureSpy = vi.fn();
    const firstOnDragStart = vi.fn();
    const secondOnDragStart = vi.fn();
    const installConfigureSpy = createConfigureSpyInstaller(configureSpy);
    const { rerender } = render(
      <DragProvider onDragStart={firstOnDragStart}>
        <RuntimeProbe onRuntime={installConfigureSpy} />
        <DraggableBox />
      </DragProvider>,
    );

    configureSpy.mockClear();
    rerender(
      <DragProvider onDragStart={secondOnDragStart}>
        <RuntimeProbe onRuntime={installConfigureSpy} />
        <DraggableBox />
      </DragProvider>,
    );

    expect(configureSpy).not.toHaveBeenCalled();
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
      });
    });

    expect(firstOnDragStart).not.toHaveBeenCalled();
    expect(secondOnDragStart).toHaveBeenCalledTimes(1);
  });

  it("keeps lifecycle refs on the last committed props during a suspended update", () => {
    const raf = installMockRaf();
    const firstOnDrop = vi.fn();
    const secondOnDrop = vi.fn();
    const suspendedRender = vi.fn();

    render(
      <SuspendedLifecycleUpdateProbe
        onCommittedDrop={firstOnDrop}
        onSuspendedDrop={secondOnDrop}
        onSuspendedRender={suspendedRender}
      />,
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
      screen.getByRole("button", { name: "Suspend update" }).click();
    });

    expect(suspendedRender).toHaveBeenCalled();

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(firstOnDrop).toHaveBeenCalledTimes(1);
    expect(secondOnDrop).not.toHaveBeenCalled();
    raf.restore();
  });

  it("keeps runtime usable after StrictMode effect replay", () => {
    const onDragStart = vi.fn();
    render(
      <StrictMode>
        <DragProvider
          onDragStart={onDragStart}
          dragOverlay={({ dragState }) => (
            <div>Overlay item {dragState.draggableId}</div>
          )}
        >
          <DraggableBox />
        </DragProvider>
      </StrictMode>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 4,
        clientY: 4,
      });
    });

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Overlay item item-1")).toBeInTheDocument();
  });

  it("cleans up runtime on unmount", () => {
    const cleanupSpy = vi.fn();
    const installCleanupSpy = createCleanupSpyInstaller(cleanupSpy);
    const { unmount } = render(
      <DragProvider>
        <RuntimeProbe onRuntime={installCleanupSpy} />
      </DragProvider>,
    );

    unmount();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("renders overlay during drag", () => {
    render(
      <DragProvider
        dragOverlay={({ dragState }) => (
          <div>Overlay item {dragState.draggableId}</div>
        )}
      >
        <DraggableBox />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 4,
        clientY: 4,
      });
    });

    expect(screen.getByText("Overlay item item-1")).toBeInTheDocument();
  });

  it("does not call the overlay render callback on pointer updates", () => {
    const raf = installMockRaf();
    const dragOverlay = vi.fn(({ dragState }) => (
      <div>Overlay item {dragState.draggableId}</div>
    ));
    render(
      <DragProvider
        announcements={{ onDragUpdate: () => "Moved" }}
        dragOverlay={dragOverlay}
      >
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 4,
        clientY: 4,
      });
    });

    expect(dragOverlay).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
    });

    expect(dragOverlay).toHaveBeenCalledTimes(1);
    raf.restore();
  });

  it("moves the overlay host on pointer updates", () => {
    const raf = installMockRaf();
    render(
      <DragProvider
        dragOverlay={({ dragState }) => (
          <div>Overlay item {dragState.draggableId}</div>
        )}
      >
        <DraggableBox />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ left: 20, top: 30, width: 40, height: 25 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 4,
        clientY: 6,
      });
    });

    const overlay = screen.getByText("Overlay item item-1");
    expect(overlay.parentElement?.style.transform).toBe(
      "translate3d(0px, 0px, 0)",
    );

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 14, clientY: 21 });
      raf.flush();
    });

    expect(overlay.parentElement?.style.transform).toBe(
      "translate3d(10px, 15px, 0)",
    );
    raf.restore();
  });

  it("measures overlay content on mount and resize without measuring on pointer updates", () => {
    const raf = installMockRaf();
    const resizeObserver = installMockResizeObserver();
    let getBoundingClientRect: ReturnType<typeof vi.fn> | null = null;
    render(
      <DragProvider
        announcements={{ onDragUpdate: () => "Moved" }}
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
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    act(() => {
      resizeObserver.instances[0]?.trigger();
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
    raf.restore();
  });

  it("supports released overlay phase and finish", () => {
    const raf = installMockRaf();
    let finishReleasedOverlay: (() => void) | null = null;
    render(
      <DragProvider
        keepOverlayOnDrop
        dragOverlay={({ dragState, phase, finish }) => {
          if (phase === "released") {
            finishReleasedOverlay = finish;
          }

          return (
            <div>
              {phase}:{dragState.draggableId}
            </div>
          );
        }}
      >
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(
      screen.getByText("released:item-1"),
    ).toBeInTheDocument();

    act(() => {
      finishReleasedOverlay?.();
    });

    expect(screen.queryByText("released:item-1")).toBeNull();
    raf.restore();
  });

  it("creates released overlay content after lifecycle state updates", () => {
    const raf = installMockRaf();
    render(<ReleaseStateOverlayProbe />);
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("droppable"),
      createRect({ left: 100, width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(screen.getByText("released:ready")).toBeInTheDocument();
    raf.restore();
  });

  it("fires lifecycle callbacks normally", () => {
    const raf = installMockRaf();
    const onDragStart = vi.fn();
    const onDragUpdate = vi.fn();
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    render(
      <DragProvider
        onDragStart={onDragStart}
        onDragUpdate={onDragUpdate}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
      >
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragUpdate).toHaveBeenCalled();
    expect(onDragEnd).toHaveBeenCalledWith(
      {
        draggableId: "item-1",
        source: "pointer",
        result: "dropped",
        dropTargetId: "target-1",
      },
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { draggableId: "item-1", source: "pointer", dropTargetId: "target-1" },
      expect.any(Object),
    );
    raf.restore();
  });

  it("fires onDragUpdate lifecycle callbacks for every pointer update", () => {
    const raf = installMockRaf();
    const onDragUpdate = vi.fn();
    render(
      <DragProvider onDragUpdate={onDragUpdate}>
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
    });
    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
    });
    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 112, clientY: 10 });
      raf.flush();
    });

    expect(onDragUpdate).toHaveBeenCalledTimes(2);
    expect(onDragUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: "pointer",
        activeDropTargetId: "target-1",
        previousDropTargetId: "target-1",
      }),
      expect.any(Object),
    );

    act(() => {
      dispatchPointerUp(window, { pointerId: 1, clientX: 112, clientY: 10 });
    });
    raf.restore();
  });

  it("announces drag updates only when the active drop target changes", () => {
    const raf = installMockRaf();
    const onDragUpdateAnnouncement = vi.fn(({ activeDropTargetId }) =>
      activeDropTargetId ? `Over ${activeDropTargetId}` : "No target",
    );
    render(
      <DragProvider
        announcements={{ onDragUpdate: onDragUpdateAnnouncement }}
      >
        <DraggableBox />
        <DroppableBox dropTargetId="target-1" testId="droppable-1" />
        <DroppableBox dropTargetId="target-2" testId="droppable-2" />
      </DragProvider>,
    );
    stubBoundingClientRect(
      screen.getByTestId("draggable"),
      createRect({ width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("droppable-1"),
      createRect({ left: 100, width: 20, height: 20 }),
    );
    stubBoundingClientRect(
      screen.getByTestId("droppable-2"),
      createRect({ left: 200, width: 20, height: 20 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
    });
    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
    });

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Over target-1")).toBeInTheDocument();

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 112, clientY: 10 });
      raf.flush();
    });

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 210, clientY: 10 });
      raf.flush();
    });

    expect(onDragUpdateAnnouncement).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Over target-2")).toBeInTheDocument();

    act(() => {
      dispatchPointerUp(window, { pointerId: 1, clientX: 210, clientY: 10 });
    });
    raf.restore();
  });

  it("dedupes repeated identical live-region messages", () => {
    const onDragEndAnnouncement = vi.fn(() => "Same");
    render(
      <DragProvider
        announcements={{
          onDragStart: () => "Same",
          onDragEnd: onDragEndAnnouncement,
        }}
      >
        <DraggableBox />
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

    const firstAnnouncement = screen.getByText("Same");

    act(() => {
      dispatchPointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });
    });

    expect(onDragEndAnnouncement).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Same")).toBe(firstAnnouncement);
  });

  it("keeps start, end, and drop announcements", () => {
    const raf = installMockRaf();
    const onDragStartAnnouncement = vi.fn(() => "Started");
    const onDragEndAnnouncement = vi.fn(() => "Ended");
    const onDropAnnouncement = vi.fn(() => "Dropped");
    render(
      <DragProvider
        announcements={{
          onDragStart: onDragStartAnnouncement,
          onDragEnd: onDragEndAnnouncement,
          onDrop: onDropAnnouncement,
        }}
      >
        <DraggableBox />
        <DroppableBox />
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
      dispatchPointerDown(screen.getByTestId("draggable"), {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
    });

    expect(screen.getByText("Started")).toBeInTheDocument();

    act(() => {
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(onDragStartAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ source: "pointer" }),
    );
    expect(onDragEndAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ source: "pointer", result: "dropped" }),
    );
    expect(onDropAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ source: "pointer" }),
    );
    expect(screen.getByText("Dropped")).toBeInTheDocument();
    raf.restore();
  });

  it("renders live region only when announcements are provided", () => {
    const { container, rerender } = render(
      <DragProvider>
        <div />
      </DragProvider>,
    );

    expect(container.querySelector("[aria-live]")).toBeNull();

    rerender(
      <DragProvider announcements={{ onDragStart: () => "Started" }}>
        <div />
      </DragProvider>,
    );

    expect(container.querySelector("[aria-live='polite']")).toBeInTheDocument();

    rerender(
      <DragProvider>
        <div />
      </DragProvider>,
    );

    expect(container.querySelector("[aria-live]")).toBeNull();
  });
});

function RuntimeProbe({
  onRuntime,
}: {
  onRuntime?: (runtime: DragRuntimeHandle) => void;
}) {
  const context = useContext(DragContext);

  if (context) {
    onRuntime?.(context.runtime);
  }

  return <span>{context ? "runtime-ready" : "missing-runtime"}</span>;
}

const neverSettlingPromise = new Promise<never>(() => {});

function SuspendedLifecycleUpdateProbe({
  onCommittedDrop,
  onSuspendedDrop,
  onSuspendedRender,
}: {
  onCommittedDrop: NonNullable<Parameters<typeof DragProvider>[0]["onDrop"]>;
  onSuspendedDrop: NonNullable<Parameters<typeof DragProvider>[0]["onDrop"]>;
  onSuspendedRender: () => void;
}) {
  const [useSuspendedProps, setUseSuspendedProps] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          startTransition(() => {
            setUseSuspendedProps(true);
          });
        }}
      >
        Suspend update
      </button>
      <Suspense fallback={<span>Pending update</span>}>
        <DragProvider
          onDrop={useSuspendedProps ? onSuspendedDrop : onCommittedDrop}
        >
          <DraggableBox />
          <DroppableBox />
          {useSuspendedProps ? (
            <SuspendedRender onRender={onSuspendedRender} />
          ) : null}
        </DragProvider>
      </Suspense>
    </>
  );
}

function SuspendedRender({ onRender }: { onRender: () => void }): null {
  onRender();
  throw neverSettlingPromise;
}

function DraggableBox() {
  const draggable = useDraggable({ draggableId: "item-1", group: "items" });

  return (
    <div {...draggable} data-testid="draggable">
      Drag me
    </div>
  );
}

function DroppableBox({
  dropTargetId = "target-1",
  testId = "droppable",
}: {
  dropTargetId?: string;
  testId?: string;
} = {}) {
  const droppable = useDroppable({ dropTargetId, group: "items" });

  return (
    <div {...droppable} data-testid={testId}>
      Drop here
    </div>
  );
}

function ReleaseStateOverlayProbe() {
  const [releaseLabel, setReleaseLabel] = useState("missing");

  return (
    <DragProvider
      keepOverlayOnDrop
      onDragEnd={() => {
        setReleaseLabel("ready");
      }}
      dragOverlay={({ phase }) => <div>{phase}:{releaseLabel}</div>}
    >
      <DraggableBox />
      <DroppableBox />
    </DragProvider>
  );
}

function installMockResizeObserver(): {
  instances: Array<{
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: () => void;
  }>;
} {
  const instances: Array<{
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: () => void;
  }> = [];

  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(private readonly callback: ResizeObserverCallback) {
      instances.push(this);
    }

    trigger(): void {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  return { instances };
}
