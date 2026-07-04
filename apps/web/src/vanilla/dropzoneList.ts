import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createDraggable,
  createDroppable,
  maxDistanceToRect,
  type DragControllerOverlayInput,
} from "@mk-drag-and-drop/dom";

type DropzoneItem = {
  draggableId: string;
  label: string;
};

type DropzoneLine = {
  targetId: string;
  beforeItemId: string | null;
};

const dropzoneListGroup = "dropzone-list";
const endDropzoneId = "dropzone-list:end";
const dragHandleText = "\u22ee\u22ee";
// Example state: initial list data is user-owned and committed on drop.
const initialItems: DropzoneItem[] = [
  { draggableId: "dropzone-item-1", label: "Item 1" },
  { draggableId: "dropzone-item-2", label: "Item 2" },
  { draggableId: "dropzone-item-3", label: "Item 3" },
  { draggableId: "dropzone-item-4", label: "Item 4" },
  { draggableId: "dropzone-item-5", label: "Item 5" },
];

export function mountDropzoneList(root: HTMLElement): () => void {
  // Example state: the app owns item order outside the package runtime.
  let items = [...initialItems];

  // Package API: creates the drag controller used by this vanilla example.
  const controller = createDragController({
    targetingAlgorithm: centerToCenter,
    targetingConstraint: maxDistanceToRect({ maxDistance: 96 }),
    dragOverlay: createDragOverlay,
    onDragStart() {
      clearActiveDropzoneLines(listElement);
    },
    onDragUpdate({ activeDropTarget, previousDropTarget }) {
      updateActiveDropzoneLine({
        root: listElement,
        activeDropTarget,
        previousDropTarget,
      });
    },
    onDragEnd() {
      clearActiveDropzoneLines(listElement);
    },
    onDrop({ draggableId, dropTarget }) {
      // Example drop behavior: translate the package drop target into list order.
      items = reorderData(items, draggableId, dropTarget);
      renderItems();
    },
  });

  const panel = document.createElement("section");
  panel.className = "examplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Dropzone list";

  const listElement = document.createElement("div");
  listElement.className = "dropzoneList";

  panel.append(title, listElement);
  root.append(panel);
  renderItems();

  return () => {
    controller.dispose();
    clearActiveDropzoneLines(listElement);
    root.replaceChildren();
  };

  // Example rendering: list markup is app-owned and rerendered from data.
  function renderItems(): void {
    const children: HTMLElement[] = [];

    for (const item of items) {
      children.push(
        createDropzoneLine(getDropzoneLineBeforeItem(item.draggableId)),
        createDropzoneItem(item),
      );
    }

    children.push(createDropzoneLine(getEndDropzoneLine()));
    listElement.replaceChildren(...children);
  }

  function createDropzoneItem(item: DropzoneItem): HTMLElement {
    // Example rendering: item markup is app-owned.
    const element = document.createElement("div");
    element.className = "dropzoneListItem";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "dragListHandle";
    handle.setAttribute("aria-label", "Drag item");
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.textContent = item.label;

    element.append(handle, label);

    // Package API: registers this DOM node and handle as draggable.
    createDraggable({
      controller,
      element,
      draggableId: item.draggableId,
      group: dropzoneListGroup,
    });
    createDragHandle({ element: handle });

    return element;
  }

  function createDropzoneLine(line: DropzoneLine): HTMLElement {
    // Example rendering: generated line markup is app-owned.
    const element = document.createElement("div");
    element.className = "dropzoneListLine";
    element.dataset.dropzoneLineTargetId = line.targetId;

    const indicator = document.createElement("div");
    indicator.className = "dropzoneListLineIndicator";
    element.append(indicator);

    // Package API: registers this generated line as a drop target.
    createDroppable({
      controller,
      element,
      targetId: line.targetId,
      group: dropzoneListGroup,
    });

    return element;
  }

  function createDragOverlay({
    dragState,
  }: DragControllerOverlayInput): HTMLElement | null {
    // Example rendering: overlay markup is app-owned and derives from drag state.
    const label = getItemLabel(items, dragState.draggableId);

    if (!label) {
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className = "sortableOverlay";

    const handle = document.createElement("div");
    handle.className = "dragListHandle";
    handle.textContent = dragHandleText;

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    overlay.append(handle, labelElement);

    return overlay;
  }
}

// Example drop behavior: map a generated dropzone line id to user-owned item order.
function reorderData(
  items: readonly DropzoneItem[],
  draggableId: string,
  dropTargetId: string,
): DropzoneItem[] {
  const dropzoneLine = getDropzoneLines(items).find(
    (line) => line.targetId === dropTargetId,
  );

  if (!dropzoneLine) {
    return [...items];
  }

  const draggedItem = items.find((item) => item.draggableId === draggableId);

  if (!draggedItem) {
    return [...items];
  }

  const nextItems = items.filter((item) => item.draggableId !== draggableId);

  if (dropzoneLine.beforeItemId === null) {
    return [...nextItems, draggedItem];
  }

  const insertionIndex = nextItems.findIndex(
    (item) => item.draggableId === dropzoneLine.beforeItemId,
  );

  if (insertionIndex === -1) {
    return [...items];
  }

  nextItems.splice(insertionIndex, 0, draggedItem);

  return nextItems;
}

// Example rendering: generated target ids are a demo convention for insertion lines.
function getDropzoneLines(items: readonly DropzoneItem[]): DropzoneLine[] {
  return [
    ...items.map((item) => getDropzoneLineBeforeItem(item.draggableId)),
    getEndDropzoneLine(),
  ];
}

function getDropzoneLineBeforeItem(draggableId: string): DropzoneLine {
  return {
    targetId: `dropzone-list:before:${draggableId}`,
    beforeItemId: draggableId,
  };
}

function getEndDropzoneLine(): DropzoneLine {
  return {
    targetId: endDropzoneId,
    beforeItemId: null,
  };
}

function getItemLabel(items: readonly DropzoneItem[], draggableId: string): string {
  return items.find((item) => item.draggableId === draggableId)?.label ?? "";
}

// Example styling: active target attributes drive demo CSS highlights.
function updateActiveDropzoneLine({
  root,
  activeDropTarget,
  previousDropTarget,
}: {
  root: ParentNode | null;
  activeDropTarget: string | null;
  previousDropTarget: string | null;
}): void {
  if (activeDropTarget === previousDropTarget) {
    return;
  }

  setDropzoneLineActive(root, previousDropTarget, false);
  setDropzoneLineActive(root, activeDropTarget, true);
}

function clearActiveDropzoneLines(root: ParentNode | null): void {
  getDropzoneLineElements(root).forEach((element) => {
    delete element.dataset.dropzoneLineActive;
  });
}

function setDropzoneLineActive(
  root: ParentNode | null,
  dropTarget: string | null,
  isActive: boolean,
): void {
  if (!dropTarget) {
    return;
  }

  getDropzoneLineElements(root).forEach((element) => {
    if (element.dataset.dropzoneLineTargetId !== dropTarget) {
      return;
    }

    if (isActive) {
      element.dataset.dropzoneLineActive = "true";
    } else {
      delete element.dataset.dropzoneLineActive;
    }
  });
}

function getDropzoneLineElements(
  root: ParentNode | null,
): NodeListOf<HTMLElement> {
  return (root ?? document).querySelectorAll("[data-dropzone-line-target-id]");
}
