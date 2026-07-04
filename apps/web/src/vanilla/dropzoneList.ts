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
  itemId: string;
  label: string;
};

type DropzoneLine = {
  targetId: string;
  beforeItemId: string | null;
};

const dropzoneListGroup = "dropzone-list";
const endDropzoneId = "dropzone-list:end";
const dragHandleText = "\u2630";
const initialItems: DropzoneItem[] = [
  { itemId: "dropzone-item-1", label: "Item 1" },
  { itemId: "dropzone-item-2", label: "Item 2" },
  { itemId: "dropzone-item-3", label: "Item 3" },
  { itemId: "dropzone-item-4", label: "Item 4" },
  { itemId: "dropzone-item-5", label: "Item 5" },
];

export function mountDropzoneList(root: HTMLElement): () => void {
  let items = [...initialItems];

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
    onDrop({ itemId, dropTarget }) {
      items = reorderData(items, itemId, dropTarget);
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

  function renderItems(): void {
    const children: HTMLElement[] = [];

    for (const item of items) {
      children.push(
        createDropzoneLine(getDropzoneLineBeforeItem(item.itemId)),
        createDropzoneItem(item),
      );
    }

    children.push(createDropzoneLine(getEndDropzoneLine()));
    listElement.replaceChildren(...children);
  }

  function createDropzoneItem(item: DropzoneItem): HTMLElement {
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

    createDraggable({
      controller,
      element,
      itemId: item.itemId,
      group: dropzoneListGroup,
    });
    createDragHandle({ element: handle });

    return element;
  }

  function createDropzoneLine(line: DropzoneLine): HTMLElement {
    const element = document.createElement("div");
    element.className = "dropzoneListLine";
    element.dataset.dropzoneLineTargetId = line.targetId;

    const indicator = document.createElement("div");
    indicator.className = "dropzoneListLineIndicator";
    element.append(indicator);

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
    const label = getItemLabel(items, dragState.itemId);

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

function reorderData(
  items: readonly DropzoneItem[],
  itemId: string,
  dropTargetId: string,
): DropzoneItem[] {
  const dropzoneLine = getDropzoneLines(items).find(
    (line) => line.targetId === dropTargetId,
  );

  if (!dropzoneLine) {
    return [...items];
  }

  const draggedItem = items.find((item) => item.itemId === itemId);

  if (!draggedItem) {
    return [...items];
  }

  const nextItems = items.filter((item) => item.itemId !== itemId);

  if (dropzoneLine.beforeItemId === null) {
    return [...nextItems, draggedItem];
  }

  const insertionIndex = nextItems.findIndex(
    (item) => item.itemId === dropzoneLine.beforeItemId,
  );

  if (insertionIndex === -1) {
    return [...items];
  }

  nextItems.splice(insertionIndex, 0, draggedItem);

  return nextItems;
}

function getDropzoneLines(items: readonly DropzoneItem[]): DropzoneLine[] {
  return [
    ...items.map((item) => getDropzoneLineBeforeItem(item.itemId)),
    getEndDropzoneLine(),
  ];
}

function getDropzoneLineBeforeItem(itemId: string): DropzoneLine {
  return {
    targetId: `dropzone-list:before:${itemId}`,
    beforeItemId: itemId,
  };
}

function getEndDropzoneLine(): DropzoneLine {
  return {
    targetId: endDropzoneId,
    beforeItemId: null,
  };
}

function getItemLabel(items: readonly DropzoneItem[], itemId: string): string {
  return items.find((item) => item.itemId === itemId)?.label ?? "";
}

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
