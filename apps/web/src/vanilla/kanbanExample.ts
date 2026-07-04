import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createDropContainer,
  createSortable,
  restrictToContainer,
  type DragController,
  type DragControllerOverlayInput,
  type DropPlacement,
} from "@mk-drag-and-drop/dom";

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
  draggableId: DropPlacement["draggableId"];
  containerId: DropPlacement["containerId"];
  previousDraggableId: DropPlacement["previousDraggableId"];
  nextDraggableId: DropPlacement["nextDraggableId"];
};

type KanbanActiveDrag =
  | { type: "column"; draggableId: string }
  | { type: "card"; draggableId: string };

const kanbanColumnGroup = "kanban-columns";
const kanbanCardGroup = "kanban-cards";
const boardContainerId = "board";
const dragHandleText = "\u2630";

// Example state: seed board data owned by the app.
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

export function mountKanbanExample(root: HTMLElement): () => void {
  const panel = document.createElement("section");
  panel.className = "examplePanel kanbanExamplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Kanban";

  const boardElement = document.createElement("div");
  boardElement.className = "kanbanBoard";

  panel.append(title, boardElement);
  root.append(panel);

  // Example state: the app owns Kanban data and active styling state.
  let kanbanState: KanbanState = cloneInitialKanbanState();
  let activeDrag: KanbanActiveDrag | null = null;

  // Package API: creates the drag controller and configures sortable targeting.
  const controller = createDragController({
    targetingAlgorithm: centerToCenter,
    modifiers: [
      restrictToContainer(({ group }) =>
        group === kanbanCardGroup ? boardElement : null,
      ),
    ],
    dragOverlay: createDragOverlay,
    onDragStart({ draggableId }) {
      activeDrag = getActiveDrag(draggableId, kanbanState);
      updateDraggingClasses();
    },
    onDragEnd() {
      activeDrag = null;
      updateDraggingClasses();
    },
    onDrop({ draggableId }, { getDropPlacement }) {
      // Example drop behavior: translate package placement into app data.
      const placement = getDropPlacement(draggableId);

      if (!placement) {
        return;
      }

      if (kanbanState.columns.some((column) => column.id === draggableId)) {
        kanbanState = moveKanbanColumn(kanbanState, placement);
        renderBoard();
        return;
      }

      if (kanbanState.cardsById[draggableId]) {
        kanbanState = moveKanbanCard(kanbanState, placement);
        renderBoard();
      }
    },
  });

  // Package API: registers the board as the column drop container.
  createDropContainer({
    controller,
    element: boardElement,
    containerId: boardContainerId,
    group: kanbanColumnGroup,
  });

  renderBoard();

  return () => {
    controller.dispose();
    root.replaceChildren();
  };

  // Example rendering: rebuild the DOM from user-owned Kanban data.
  function renderBoard(): void {
    boardElement.replaceChildren(
      ...kanbanState.columns.map((column) =>
        createKanbanColumn(controller, column, kanbanState.cardsById),
      ),
    );
    updateDraggingClasses();
  }

  // Example rendering: overlay markup is app-owned and uses package drag state.
  function createDragOverlay({
    dragState,
  }: DragControllerOverlayInput): HTMLElement | null {
    if (dragState.group === kanbanColumnGroup) {
      return createColumnOverlay(dragState.draggableId);
    }

    if (dragState.group === kanbanCardGroup) {
      return createCardOverlay(dragState.draggableId);
    }

    return null;
  }

  function createColumnOverlay(columnId: string): HTMLElement | null {
    const column = kanbanState.columns.find(
      (currentColumn) => currentColumn.id === columnId,
    );

    if (!column) {
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className = "kanbanDragOverlay kanbanColumnDragOverlay";

    const handle = document.createElement("div");
    handle.className = "kanbanDragOverlayHandle";
    handle.textContent = dragHandleText;

    const titleElement = document.createElement("span");
    titleElement.className = "kanbanDragOverlayTitle";
    titleElement.textContent = column.title;

    const countElement = document.createElement("span");
    countElement.className = "kanbanColumnCount";
    countElement.textContent = String(column.cardIds.length);

    overlay.append(handle, titleElement, countElement);
    return overlay;
  }

  function createCardOverlay(cardId: string): HTMLElement | null {
    const card = kanbanState.cardsById[cardId];

    if (!card) {
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className = "kanbanDragOverlay kanbanCardDragOverlay";

    appendKanbanCardContents(overlay, card);
    return overlay;
  }

  // Example styling: sync demo drag classes from app state.
  function updateDraggingClasses(): void {
    boardElement
      .querySelectorAll<HTMLElement>("[data-kanban-column-id]")
      .forEach((element) => {
        element.classList.toggle(
          "kanbanColumnDragging",
          activeDrag?.type === "column" &&
            activeDrag.draggableId === element.dataset.kanbanColumnId,
        );
      });

    boardElement
      .querySelectorAll<HTMLElement>("[data-kanban-card-id]")
      .forEach((element) => {
        element.classList.toggle(
          "kanbanCardDragging",
          activeDrag?.type === "card" &&
            activeDrag.draggableId === element.dataset.kanbanCardId,
        );
      });
  }
}

// Example rendering: column markup can be replaced by users.
function createKanbanColumn(
  controller: DragController,
  column: KanbanColumn,
  cardsById: Record<string, KanbanCard>,
): HTMLElement {
  const element = document.createElement("section");
  element.className = "kanbanColumn";
  element.dataset.kanbanColumnId = column.id;

  // Package API: registers the column as a sortable item.
  createSortable({
    controller,
    element,
    draggableId: column.id,
    group: kanbanColumnGroup,
    containerId: boardContainerId,
  });

  const header = document.createElement("header");
  header.className = "kanbanColumnHeader";

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "kanbanColumnHandle";
  handle.setAttribute("aria-label", `Drag ${column.title}`);
  handle.textContent = dragHandleText;
  // Package API: limits column drag start to the handle.
  createDragHandle({ element: handle });

  const titleElement = document.createElement("h3");
  titleElement.className = "kanbanColumnTitle";
  titleElement.textContent = column.title;

  const countElement = document.createElement("span");
  countElement.className = "kanbanColumnCount";
  countElement.textContent = String(column.cardIds.length);

  header.append(handle, titleElement, countElement);

  const cardList = document.createElement("div");
  cardList.className = "kanbanCardList";
  // Package API: registers the column body as a card drop container.
  createDropContainer({
    controller,
    element: cardList,
    containerId: column.id,
    group: kanbanCardGroup,
  });

  for (const cardId of column.cardIds) {
    const card = cardsById[cardId];

    if (card) {
      cardList.append(createKanbanCard(controller, card, column.id));
    }
  }

  element.append(header, cardList);
  return element;
}

// Example rendering: card markup is app-owned.
function createKanbanCard(
  controller: DragController,
  card: KanbanCard,
  columnId: string,
): HTMLElement {
  const element = document.createElement("article");
  element.className = "kanbanCard";
  element.dataset.kanbanCardId = card.id;

  // Package API: registers the card as a sortable item.
  createSortable({
    controller,
    element,
    draggableId: card.id,
    group: kanbanCardGroup,
    containerId: columnId,
  });

  appendKanbanCardContents(element, card);
  return element;
}

// Example rendering: shared card content markup.
function appendKanbanCardContents(
  element: HTMLElement,
  card: KanbanCard,
): void {
  const labelElement = document.createElement("span");
  labelElement.className = "kanbanCardLabel";
  labelElement.textContent = card.label;

  const titleElement = document.createElement("span");
  titleElement.className = "kanbanCardTitle";
  titleElement.textContent = card.title;

  element.append(labelElement, titleElement);
}

function getActiveDrag(
  draggableId: string,
  state: KanbanState,
): KanbanActiveDrag | null {
  if (state.columns.some((column) => column.id === draggableId)) {
    return { type: "column", draggableId };
  }

  if (state.cardsById[draggableId]) {
    return { type: "card", draggableId };
  }

  return null;
}

// Example drop behavior: apply package placement to user-owned Kanban data.
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

function cloneInitialKanbanState(): KanbanState {
  return {
    columns: initialKanbanState.columns.map((column) => ({
      ...column,
      cardIds: [...column.cardIds],
    })),
    cardsById: Object.fromEntries(
      Object.entries(initialKanbanState.cardsById).map(([cardId, card]) => [
        cardId,
        { ...card },
      ]),
    ),
  };
}
