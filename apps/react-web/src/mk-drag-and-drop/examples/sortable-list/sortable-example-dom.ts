import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createSortable,
  lockToYAxis,
  maxOverlayCenterDistanceToRect,
  type DragControllerOverlayInput,
} from "@mk-drag-and-drop/dom";

import { moveItemToSortablePlacement } from "./sortable-placement";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const dragHandleText = "\u22ee\u22ee";
const sortableDraggableIdAttribute = "data-vanilla-sortable-item-id";

export function mountSortableList(root: HTMLElement): () => void {
  let items = [...defaultItems];
  let activeItemId: string | null = null;

  const controller = createDragController({
    modifiers: [lockToYAxis()],
    targetingAlgorithm: centerToCenter,
    targetingConstraint: maxOverlayCenterDistanceToRect({ maxDistance: 96 }),
    dragOverlay: createDragOverlay,
    onDragStart({ draggableId }) {
      activeItemId = draggableId;
      updateItemDraggingClasses();
    },
    onDragEnd() {
      activeItemId = null;
      updateItemDraggingClasses();
    },
    onDrop({ draggableId, sortablePlacement }) {
      if (!sortablePlacement) {
        return;
      }

      items = moveItemToSortablePlacement(
        items,
        draggableId,
        sortablePlacement,
      );
      renderItems();
    },
  });

  const panel = document.createElement("section");
  panel.className = "examplePanel";

  const listElement = document.createElement("div");
  listElement.className = "sortableParent";

  panel.append(listElement);
  root.append(panel);
  renderItems();

  return () => {
    root.replaceChildren();
  };

  function renderItems(): void {
    listElement.replaceChildren(
      ...items.map((draggableId) => createSortableItem(draggableId)),
    );
    updateItemDraggingClasses();
  }

  function updateItemDraggingClasses(): void {
    listElement
      .querySelectorAll<HTMLElement>(`[${sortableDraggableIdAttribute}]`)
      .forEach((element) => {
        element.classList.toggle(
          "sortableItemDragging",
          element.getAttribute(sortableDraggableIdAttribute) === activeItemId,
        );
      });
  }

  function createSortableItem(draggableId: string): HTMLElement {
    const element = document.createElement("div");
    element.className =
      activeItemId === draggableId
        ? "sortableItem sortableItemDragging"
        : "sortableItem";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "dragListHandle";
    handle.setAttribute("aria-label", "Drag item");
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.textContent = `Item ${draggableId}`;

    element.append(handle, label);
    element.setAttribute(sortableDraggableIdAttribute, draggableId);

    createSortable({
      controller,
      element,
      draggableId,
      group: sortableGroup,
    });
    createDragHandle({ element: handle });

    return element;
  }

  function createDragOverlay({
    dragState,
  }: DragControllerOverlayInput): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "sortableOverlay";
    appendOverlayContents(overlay, dragState.draggableId);

    return overlay;
  }
}

function appendOverlayContents(
  element: HTMLElement,
  draggableId: string,
): void {
  const handle = document.createElement("div");
  handle.className = "dragListHandle";
  handle.textContent = dragHandleText;

  const label = document.createElement("span");
  label.textContent = `Item ${draggableId}`;

  element.append(handle, label);
}
