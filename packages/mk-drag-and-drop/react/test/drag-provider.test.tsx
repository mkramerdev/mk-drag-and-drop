import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
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

function createDisposeSpyInstaller(
  spy: () => void,
): (runtime: DragRuntimeHandle) => void {
  let installed = false;

  return (runtime) => {
    if (installed) {
      return;
    }

    installed = true;
    const dispose = runtime.dispose;
    runtime.dispose = () => {
      spy();
      dispose();
    };
  };
}

describe("DragProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides runtime context", () => {
    render(
      <DragProvider>
        <RuntimeProbe />
      </DragProvider>,
    );

    expect(screen.getByText("runtime-ready")).toBeInTheDocument();
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

  it("disposes runtime on unmount", () => {
    const disposeSpy = vi.fn();
    const installDisposeSpy = createDisposeSpyInstaller(disposeSpy);
    const { unmount } = render(
      <DragProvider>
        <RuntimeProbe onRuntime={installDisposeSpy} />
      </DragProvider>,
    );

    unmount();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
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

  it("supports released overlay phase and finish", async () => {
    const user = userEvent.setup();
    const raf = installMockRaf();
    render(
      <DragProvider
        keepOverlayOnDrop
        dragOverlay={({ dragState, phase, finish }) => (
          <button type="button" onClick={finish}>
            {phase}:{dragState.draggableId}
          </button>
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
      dispatchPointerMove(window, { pointerId: 1, clientX: 110, clientY: 10 });
      raf.flush();
      dispatchPointerUp(window, { pointerId: 1, clientX: 110, clientY: 10 });
    });

    expect(
      screen.getByRole("button", { name: "released:item-1" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "released:item-1" }));

    expect(
      screen.queryByRole("button", { name: "released:item-1" }),
    ).toBeNull();
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
  });
});

function RuntimeProbe({
  onRuntime,
}: {
  onRuntime?: (runtime: DragRuntimeHandle) => void;
}) {
  const runtime = useContext(DragContext);

  if (runtime) {
    onRuntime?.(runtime);
  }

  return <span>{runtime ? "runtime-ready" : "missing-runtime"}</span>;
}

function DraggableBox() {
  const draggable = useDraggable({ draggableId: "item-1", group: "items" });

  return (
    <div {...draggable} data-testid="draggable">
      Drag me
    </div>
  );
}

function DroppableBox() {
  const droppable = useDroppable({ targetId: "target-1", group: "items" });

  return (
    <div {...droppable} data-testid="droppable">
      Drop here
    </div>
  );
}
