import {
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";

import {
  centerToCenter,
  DragProvider,
  composeRefs,
  restrictToContainer,
  useDragHandle,
  useDropContainer,
  useSortable,
  type DragState,
} from "@mk-drag-and-drop/react";

type KanbanCard = {
  id: string;
  title: string;
  label: string;
};

type KanbanColumn = {
  id: string;
  title: string;
  cardIds: string[];
};

type KanbanState = {
  columns: KanbanColumn[];
  cardsById: Record<string, KanbanCard>;
};

type PlacementInput = {
  draggableId: string;
  containerId: string | null;
  previousDraggableId: string | null;
  nextDraggableId: string | null;
};

type KanbanActiveDrag =
  | {
      type: "column";
      draggableId: string;
    }
  | {
      type: "card";
      draggableId: string;
    };

const kanbanColumnGroup = "kanban-columns";
const kanbanCardGroup = "kanban-cards";
const boardContainerId = "board";
const dragHandleText = "\u22ee\u22ee";

// Example state: initial board data is user-owned and committed on drop.
const initialKanbanState: KanbanState = {
  columns: [
    {
      id: "column-backlog",
      title: "Backlog",
      cardIds: [
        "card-brief",
        "card-research",
        "card-empty",
        "card-keyboard",
        "card-accessibility",
      ],
    },
    {
      id: "column-progress",
      title: "In progress",
      cardIds: [
        "card-api",
        "card-preview",
        "card-autoscroll",
        "card-measurement",
        "card-constraints",
      ],
    },
    {
      id: "column-review",
      title: "Review",
      cardIds: [
        "card-docs",
        "card-react",
        "card-regression",
        "card-release",
        "card-pack",
      ],
    },
  ],
  cardsById: {
    "card-brief": {
      id: "card-brief",
      title: "Write Kanban usage notes",
      label: "Docs",
    },
    "card-research": {
      id: "card-research",
      title: "Audit empty column behavior",
      label: "Runtime",
    },
    "card-empty": {
      id: "card-empty",
      title: "Verify empty list drop targets",
      label: "Containers",
    },
    "card-keyboard": {
      id: "card-keyboard",
      title: "Check keyboard sortable movement",
      label: "A11y",
    },
    "card-accessibility": {
      id: "card-accessibility",
      title: "Review drag handle labels",
      label: "A11y",
    },
    "card-api": {
      id: "card-api",
      title: "Container-aware placement",
      label: "DOM",
    },
    "card-preview": {
      id: "card-preview",
      title: "Cross-parent sortable preview",
      label: "Sortable",
    },
    "card-autoscroll": {
      id: "card-autoscroll",
      title: "Exercise scrolling board updates",
      label: "Runtime",
    },
    "card-measurement": {
      id: "card-measurement",
      title: "Refresh target measurements",
      label: "Geometry",
    },
    "card-constraints": {
      id: "card-constraints",
      title: "Tune board movement constraints",
      label: "Modifiers",
    },
    "card-docs": {
      id: "card-docs",
      title: "React hook surface",
      label: "React",
    },
    "card-react": {
      id: "card-react",
      title: "Sync React Kanban behavior",
      label: "React",
    },
    "card-regression": {
      id: "card-regression",
      title: "Record cross-column preview cases",
      label: "Tests",
    },
    "card-release": {
      id: "card-release",
      title: "Prepare patch release notes",
      label: "Release",
    },
    "card-pack": {
      id: "card-pack",
      title: "Dry-run package contents",
      label: "Build",
    },
  },
};

export function KanbanExample(): ReactElement {
  const boardRef = useRef<HTMLDivElement | null>(null);
  // Example state: board data and active styling state live outside the package runtime.
  const [kanbanState, setKanbanState] = useState<KanbanState>(
    () => initialKanbanState,
  );
  const [activeDrag, setActiveDrag] = useState<KanbanActiveDrag | null>(
    null,
  );
  // Package API: modifier constrains card drags to the rendered board element.
  const modifiers = useMemo(
    () => [
      restrictToContainer(({ group }) =>
        group === kanbanCardGroup ? boardRef.current : null,
      ),
    ],
    [],
  );

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      targetingAlgorithm={centerToCenter}
      modifiers={modifiers}
      dragOverlay={({ dragState }) => (
        <KanbanDragOverlay dragState={dragState} kanbanState={kanbanState} />
      )}
      onDragStart={({ draggableId }) => {
        if (kanbanState.columns.some((column) => column.id === draggableId)) {
          setActiveDrag({ type: "column", draggableId });
          return;
        }

        if (kanbanState.cardsById[draggableId]) {
          setActiveDrag({ type: "card", draggableId });
        }
      }}
      onDragEnd={() => {
        setActiveDrag(null);
      }}
      onDrop={({ draggableId, sortablePlacement }) => {
        const placement = sortablePlacement
          ? { draggableId, ...sortablePlacement }
          : null;

        if (!placement) {
          return;
        }

        // Example drop behavior: translate package placement into board data.
        setKanbanState((currentState) => {
          if (currentState.columns.some((column) => column.id === draggableId)) {
            return moveKanbanColumn(currentState, placement);
          }

          if (!currentState.cardsById[draggableId]) {
            return currentState;
          }

          return moveKanbanCard(currentState, placement);
        });
      }}
    >
      <KanbanBoardView
        kanbanState={kanbanState}
        activeDrag={activeDrag}
        boardRef={boardRef}
      />
    </DragProvider>
  );
}

// Example rendering: overlay markup is app-owned and derives from drag state.
function KanbanDragOverlay({
  dragState,
  kanbanState,
}: {
  dragState: DragState;
  kanbanState: KanbanState;
}): ReactElement | null {
  if (dragState.group === kanbanColumnGroup) {
    const column = kanbanState.columns.find(
      (currentColumn) => currentColumn.id === dragState.draggableId,
    );

    if (!column) {
      return null;
    }

    return (
      <div className="kanbanDragOverlay kanbanColumnDragOverlay">
        <div className="kanbanDragOverlayHandle">
          {dragHandleText}
        </div>
        <span className="kanbanDragOverlayTitle">{column.title}</span>
        <span className="kanbanColumnCount">{column.cardIds.length}</span>
      </div>
    );
  }

  if (dragState.group !== kanbanCardGroup) {
    return null;
  }

  const card = kanbanState.cardsById[dragState.draggableId];

  if (!card) {
    return null;
  }

  return (
    <div className="kanbanDragOverlay kanbanCardDragOverlay">
      <span className="kanbanCardLabel">{card.label}</span>
      <span className="kanbanCardTitle">{card.title}</span>
    </div>
  );
}

// Example rendering: board markup is app-owned; drop-container hooks wire it to the package.
function KanbanBoardView({
  kanbanState,
  activeDrag,
  boardRef,
}: {
  kanbanState: KanbanState;
  activeDrag: KanbanActiveDrag | null;
  boardRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  // Package API: registers the board as the column drop container.
  const boardContainer = useDropContainer({
    containerId: boardContainerId,
    group: kanbanColumnGroup,
  });
  const { ref: boardContainerRef, ...boardContainerProps } = boardContainer;
  const composedBoardRef = useMemo(
    () => composeRefs(boardContainerRef, boardRef),
    [boardContainerRef, boardRef],
  );

  return (
    <section className="examplePanel kanbanExamplePanel">
      <h2 className="exampleTitle">Kanban</h2>
      <div
        {...boardContainerProps}
        ref={composedBoardRef}
        className="kanbanBoard"
      >
        {kanbanState.columns.map((column) => (
          <KanbanColumnView
            key={column.id}
            column={column}
            cardsById={kanbanState.cardsById}
            activeDrag={activeDrag}
          />
        ))}
      </div>
    </section>
  );
}

// Example rendering: column markup is app-owned; package hooks register sortable/drop roles.
function KanbanColumnView({
  column,
  cardsById,
  activeDrag,
}: {
  column: KanbanColumn;
  cardsById: Record<string, KanbanCard>;
  activeDrag: KanbanActiveDrag | null;
}): ReactElement {
  // Package API: registers the column and its card list with the drag runtime.
  const columnSortable = useSortable({
    draggableId: column.id,
    group: kanbanColumnGroup,
    containerId: boardContainerId,
    axis: "horizontal",
    placementBoundary: { start: 0, end: 1 },
  });
  const cardContainer = useDropContainer({
    containerId: column.id,
    group: kanbanCardGroup,
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <section
      {...columnSortable}
      className={
        activeDrag?.type === "column" && activeDrag.draggableId === column.id
          ? "kanbanColumn kanbanColumnDragging"
          : "kanbanColumn"
      }
    >
      <header className="kanbanColumnHeader">
        <button
          {...handle}
          type="button"
          className="kanbanColumnHandle"
          aria-label={`Drag ${column.title}`}
        >
          {dragHandleText}
        </button>
        <h3 className="kanbanColumnTitle">{column.title}</h3>
        <span className="kanbanColumnCount">{column.cardIds.length}</span>
      </header>
      <div {...cardContainer} className="kanbanCardList">
        {column.cardIds.map((cardId) => {
          const card = cardsById[cardId];

          return card ? (
            <KanbanCardView
              key={card.id}
              card={card}
              columnId={column.id}
              isDragging={
                activeDrag?.type === "card" && activeDrag.draggableId === card.id
              }
            />
          ) : null;
        })}
      </div>
    </section>
  );
}

// Example rendering: card markup is app-owned; sortable hook wires it to the package.
function KanbanCardView({
  card,
  columnId,
  isDragging,
}: {
  card: KanbanCard;
  columnId: string;
  isDragging: boolean;
}): ReactElement {
  // Package API: registers this rendered card as a sortable item.
  const sortable = useSortable({
    draggableId: card.id,
    group: kanbanCardGroup,
    containerId: columnId,
  });

  return (
    <article
      {...sortable}
      className={isDragging ? "kanbanCard kanbanCardDragging" : "kanbanCard"}
    >
      <span className="kanbanCardLabel">{card.label}</span>
      <span className="kanbanCardTitle">{card.title}</span>
    </article>
  );
}

// Example drop behavior: move a column using package placement data.
function moveKanbanColumn(
  state: KanbanState,
  placement: PlacementInput,
): KanbanState {
  if (placement.containerId !== boardContainerId) {
    return state;
  }

  return {
    ...state,
    columns: moveByPlacement({
      items: state.columns,
      getItemId: (column) => column.id,
      placement,
    }),
  };
}

// Example drop behavior: move a card between user-owned column arrays.
function moveKanbanCard(
  state: KanbanState,
  placement: PlacementInput,
): KanbanState {
  if (!placement.containerId) {
    return state;
  }

  return {
    ...state,
    columns: state.columns.map((column) => {
      const cardIdsWithoutMovedCard = column.cardIds.filter(
        (cardId) => cardId !== placement.draggableId,
      );

      if (column.id !== placement.containerId) {
        return {
          ...column,
          cardIds: cardIdsWithoutMovedCard,
        };
      }

      return {
        ...column,
        cardIds: insertIdByPlacement(cardIdsWithoutMovedCard, placement),
      };
    }),
  };
}

// Example drop behavior: shared placement helper for this demo's data shape.
function moveByPlacement<T>(input: {
  items: readonly T[];
  getItemId: (item: T) => string;
  placement: PlacementInput;
}): T[] {
  const item = input.items.find(
    (currentItem) => input.getItemId(currentItem) === input.placement.draggableId,
  );

  if (!item) {
    return [...input.items];
  }

  const itemsWithoutMovedItem = input.items.filter(
    (currentItem) => input.getItemId(currentItem) !== input.placement.draggableId,
  );
  const insertIndex = getPlacementIndex({
    ids: itemsWithoutMovedItem.map(input.getItemId),
    placement: input.placement,
  });
  const nextItems = [...itemsWithoutMovedItem];
  nextItems.splice(insertIndex, 0, item);

  return nextItems;
}

function insertIdByPlacement(
  ids: readonly string[],
  placement: PlacementInput,
): string[] {
  const nextIds = [...ids];
  const insertIndex = getPlacementIndex({ ids: nextIds, placement });
  nextIds.splice(insertIndex, 0, placement.draggableId);

  return nextIds;
}

function getPlacementIndex(input: {
  ids: readonly string[];
  placement: PlacementInput;
}): number {
  if (input.placement.previousDraggableId) {
    const previousIndex = input.ids.indexOf(input.placement.previousDraggableId);

    if (previousIndex !== -1) {
      return previousIndex + 1;
    }
  }

  if (input.placement.nextDraggableId) {
    const nextIndex = input.ids.indexOf(input.placement.nextDraggableId);

    if (nextIndex !== -1) {
      return nextIndex;
    }
  }

  return input.ids.length;
}
