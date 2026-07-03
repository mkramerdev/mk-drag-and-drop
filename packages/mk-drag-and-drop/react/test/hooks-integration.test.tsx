import { StrictMode, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DragRuntime } from "@mk-drag-and-drop/dom";
import {
  DragProvider,
  useDragHandle,
  useDropContainer,
  useDraggable,
  useDroppable,
  useRemeasureDropTargets,
  useSortable,
} from "../src/index.js";
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

    consoleError.mockRestore();
  });

  it("useDroppable registers and unregisters on callback ref changes", () => {
    const registerSpy = vi.spyOn(DragRuntime.prototype, "registerDropTarget");
    const unregisterSpy = vi.spyOn(DragRuntime.prototype, "unregisterDropTarget");
    const { rerender, unmount } = render(
      <DragProvider>
        <DynamicDroppable targetId="target-1" />
      </DragProvider>,
    );

    rerender(
      <DragProvider>
        <DynamicDroppable targetId="target-2" />
      </DragProvider>,
    );
    unmount();

    expect(registerSpy).toHaveBeenCalledWith(
      "target-1",
      expect.any(HTMLElement),
      "items",
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "target-2",
      expect.any(HTMLElement),
      "items",
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "target-1",
      expect.any(HTMLElement),
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "target-2",
      expect.any(HTMLElement),
    );
  });

  it("useDropContainer registers and unregisters on callback ref changes", () => {
    const registerSpy = vi.spyOn(DragRuntime.prototype, "registerDropContainer");
    const unregisterSpy = vi.spyOn(
      DragRuntime.prototype,
      "unregisterDropContainer",
    );
    const { rerender, unmount } = render(
      <DragProvider>
        <DynamicDropContainer containerId="container-1" />
      </DragProvider>,
    );

    rerender(
      <DragProvider>
        <DynamicDropContainer containerId="container-2" />
      </DragProvider>,
    );
    unmount();

    expect(registerSpy).toHaveBeenCalledWith(
      "container-1",
      expect.any(HTMLElement),
      "items",
    );
    expect(registerSpy).toHaveBeenCalledWith(
      "container-2",
      expect.any(HTMLElement),
      "items",
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "container-1",
      expect.any(HTMLElement),
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "container-2",
      expect.any(HTMLElement),
    );
  });

  it("ref cleanup works under React StrictMode", () => {
    const unregisterSpy = vi.spyOn(DragRuntime.prototype, "unregisterDropTarget");
    const { unmount } = render(
      <StrictMode>
        <DragProvider>
          <DynamicDroppable targetId="target-1" />
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
    const registerSpy = vi.spyOn(DragRuntime.prototype, "registerDropContainer");
    const unregisterSpy = vi.spyOn(
      DragRuntime.prototype,
      "unregisterDropContainer",
    );
    const { unmount } = render(
      <StrictMode>
        <DragProvider>
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
    const registerSpy = vi.spyOn(DragRuntime.prototype, "registerDropTarget");
    const unregisterSpy = vi.spyOn(DragRuntime.prototype, "unregisterDropTarget");
    const onDragStart = vi.fn();
    const { unmount } = render(
      <DragProvider onDragStart={onDragStart}>
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

    expect(registerSpy).toHaveBeenCalledWith(
      "item-1",
      expect.any(HTMLElement),
      "items",
      {
        containerId: "container-1",
        kind: "item",
      },
    );
    expect(unregisterSpy).toHaveBeenCalledWith(
      "item-1",
      expect.any(HTMLElement),
    );
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
        onDragStart={({ itemId }) => calls.push(`start:${itemId}`)}
        onDragUpdate={({ activeDropTarget }) =>
          calls.push(`update:${activeDropTarget}`)
        }
        onDragEnd={({ dropTarget }) => calls.push(`end:${dropTarget}`)}
        onDrop={({ itemId, dropTarget }) =>
          calls.push(`drop:${itemId}:${dropTarget}`)
        }
      >
        <DraggableWithChild />
        <DynamicDroppable targetId="target-1" />
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
        <DynamicDroppable targetId="target-1" />
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
      expect.objectContaining({ itemId: "item-1" }),
      expect.any(Object),
    );
    expect(onDrop).toHaveBeenCalledWith(
      { itemId: "item-1", dropTarget: "target-1" },
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
      { itemId: "item-1", dropTarget: null },
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
          onDragStart: ({ itemId }) => `Started ${itemId}`,
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

    expect(screen.getByText("Started item-1")).toBeInTheDocument();
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
      { itemId: "item-1", dropTarget: null },
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
});

function UseDraggableOutside() {
  useDraggable({ itemId: "item-1" });
  return null;
}

function UseDroppableOutside() {
  useDroppable({ targetId: "target-1" });
  return null;
}

function UseDropContainerOutside() {
  useDropContainer({ containerId: "container-1" });
  return null;
}

function UseSortableOutside() {
  useSortable({ itemId: "item-1" });
  return null;
}

function UseRemeasureOutside() {
  useRemeasureDropTargets();
  return null;
}

function DynamicDroppable({ targetId }: { targetId: string }) {
  const droppable = useDroppable({ targetId, group: "items" });

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

function DraggableWithChild() {
  const draggable = useDraggable({ itemId: "item-1", group: "items" });

  return (
    <div {...draggable} data-testid="draggable">
      Drag me
      <button type="button">Edit</button>
    </div>
  );
}

function SortableWithHandle() {
  const sortable = useSortable({
    itemId: "item-1",
    group: "items",
    containerId: "container-1",
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...sortable} data-testid="sortable">
      <button {...handle} type="button" aria-label="Drag item">
        Grip
      </button>
      Item
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
      onDrop={({ itemId }, { getDropPlacement }) => {
        const placement = getDropPlacement(itemId);

        if (!placement?.containerId) {
          return;
        }

        setColumns((currentColumns) =>
          moveKanbanCard(currentColumns, {
            cardId: itemId,
            toColumnId: placement.containerId ?? "",
            previousCardId: placement.previousItemId,
            nextCardId: placement.nextItemId,
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
    itemId: column.id,
    group: "kanban-columns",
    containerId: "board",
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
    itemId: cardId,
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
