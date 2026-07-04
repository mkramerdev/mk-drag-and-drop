import {
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { GripVertical } from "lucide-react";

import {
  DragProvider,
  restrictToContainer,
  type DragState,
} from "@mk-drag-and-drop/react/drag-provider";
import { composeRefs } from "@mk-drag-and-drop/react/compose-refs";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useDropContainer } from "@mk-drag-and-drop/react/use-drop-container";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import { centerToCenter } from "@mk-drag-and-drop/dom";

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
  itemId: string;
  containerId: string | null;
  previousItemId: string | null;
  nextItemId: string | null;
};

type KanbanActiveDrag =
  | {
      type: "column";
      itemId: string;
    }
  | {
      type: "card";
      itemId: string;
    };

const kanbanColumnGroup = "kanban-columns";
const kanbanCardGroup = "kanban-cards";
const boardContainerId = "board";

const initialKanbanState: KanbanState = {
  columns: [
    {
      id: "column-backlog",
      title: "Backlog",
      cardIds: ["card-brief", "card-research"],
    },
    {
      id: "column-progress",
      title: "In progress",
      cardIds: ["card-api", "card-preview"],
    },
    {
      id: "column-review",
      title: "Review",
      cardIds: ["card-docs"],
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
    "card-docs": {
      id: "card-docs",
      title: "React hook surface",
      label: "React",
    },
  },
};

export function KanbanExample(): ReactElement {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [kanbanState, setKanbanState] = useState<KanbanState>(
    () => initialKanbanState,
  );
  const [activeDrag, setActiveDrag] = useState<KanbanActiveDrag | null>(
    null,
  );
  const modifiers = useMemo(
    () => [
      restrictToContainer(({ group }) =>
        group === kanbanCardGroup ? boardRef.current : null,
      ),
    ],
    [],
  );

  return (
    <DragProvider
      targetingAlgorithm={centerToCenter}
      modifiers={modifiers}
      dragOverlay={({ dragState }) => (
        <KanbanDragOverlay dragState={dragState} kanbanState={kanbanState} />
      )}
      onDragStart={({ itemId }) => {
        if (kanbanState.columns.some((column) => column.id === itemId)) {
          setActiveDrag({ type: "column", itemId });
          return;
        }

        if (kanbanState.cardsById[itemId]) {
          setActiveDrag({ type: "card", itemId });
        }
      }}
      onDragEnd={() => {
        setActiveDrag(null);
      }}
      onDrop={({ itemId }, { getDropPlacement }) => {
        const placement = getDropPlacement(itemId);

        if (!placement) {
          return;
        }

        setKanbanState((currentState) => {
          if (currentState.columns.some((column) => column.id === itemId)) {
            return moveKanbanColumn(currentState, placement);
          }

          if (!currentState.cardsById[itemId]) {
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

function KanbanDragOverlay({
  dragState,
  kanbanState,
}: {
  dragState: DragState;
  kanbanState: KanbanState;
}): ReactElement | null {
  if (dragState.group === kanbanColumnGroup) {
    const column = kanbanState.columns.find(
      (currentColumn) => currentColumn.id === dragState.itemId,
    );

    if (!column) {
      return null;
    }

    return (
      <div className="kanbanDragOverlay kanbanColumnDragOverlay">
        <div className="kanbanDragOverlayHandle">
          <GripVertical aria-hidden="true" />
        </div>
        <span className="kanbanDragOverlayTitle">{column.title}</span>
        <span className="kanbanColumnCount">{column.cardIds.length}</span>
      </div>
    );
  }

  if (dragState.group !== kanbanCardGroup) {
    return null;
  }

  const card = kanbanState.cardsById[dragState.itemId];

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

function KanbanBoardView({
  kanbanState,
  activeDrag,
  boardRef,
}: {
  kanbanState: KanbanState;
  activeDrag: KanbanActiveDrag | null;
  boardRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
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

function KanbanColumnView({
  column,
  cardsById,
  activeDrag,
}: {
  column: KanbanColumn;
  cardsById: Record<string, KanbanCard>;
  activeDrag: KanbanActiveDrag | null;
}): ReactElement {
  const columnSortable = useSortable({
    itemId: column.id,
    group: kanbanColumnGroup,
    containerId: boardContainerId,
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
        activeDrag?.type === "column" && activeDrag.itemId === column.id
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
          <GripVertical aria-hidden="true" />
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
                activeDrag?.type === "card" && activeDrag.itemId === card.id
              }
            />
          ) : null;
        })}
      </div>
    </section>
  );
}

function KanbanCardView({
  card,
  columnId,
  isDragging,
}: {
  card: KanbanCard;
  columnId: string;
  isDragging: boolean;
}): ReactElement {
  const sortable = useSortable({
    itemId: card.id,
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
        (cardId) => cardId !== placement.itemId,
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

function moveByPlacement<T>(input: {
  items: readonly T[];
  getItemId: (item: T) => string;
  placement: PlacementInput;
}): T[] {
  const item = input.items.find(
    (currentItem) => input.getItemId(currentItem) === input.placement.itemId,
  );

  if (!item) {
    return [...input.items];
  }

  const itemsWithoutMovedItem = input.items.filter(
    (currentItem) => input.getItemId(currentItem) !== input.placement.itemId,
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
  nextIds.splice(insertIndex, 0, placement.itemId);

  return nextIds;
}

function getPlacementIndex(input: {
  ids: readonly string[];
  placement: PlacementInput;
}): number {
  if (input.placement.previousItemId) {
    const previousIndex = input.ids.indexOf(input.placement.previousItemId);

    if (previousIndex !== -1) {
      return previousIndex + 1;
    }
  }

  if (input.placement.nextItemId) {
    const nextIndex = input.ids.indexOf(input.placement.nextItemId);

    if (nextIndex !== -1) {
      return nextIndex;
    }
  }

  return input.ids.length;
}
