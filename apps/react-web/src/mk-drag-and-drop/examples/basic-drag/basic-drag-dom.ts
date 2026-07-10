import {
  createDragController,
  createDraggable,
  createDroppable,
  createDragHandle,
  maxPointerDistanceToRect,
  pointerToRectDistance,
  restrictToContainer,
  type DragController,
  type DragControllerOverlayInput,
} from "@mk-drag-and-drop/dom";

const draggableItem = {
  draggableId: "draggable",
  label: "Item",
};

const rootContainer = {
  dropTargetId: "droppable-root",
  label: "Drop Back Here",
};

const droppableContainer = {
  dropTargetId: "droppable",
  label: "Drop Here",
};

const basicGroup = "basic";
const dragHandleText = "\u22ee\u22ee";

export function mountBasicDrag(root: HTMLElement): () => void {
  // Example state: the app owns active target styling.
  const dropzoneElements = new Map<string, HTMLElement>();
  let activeDropTargetId: string | null = null;

  const dragContainerElement = document.createElement("div");
  dragContainerElement.className = "draggableItemContainer";

  // Package API: creates the drag controller used by this vanilla example.
  const controller = createDragController({
    targetingAlgorithm: pointerToRectDistance,
    targetingConstraint: maxPointerDistanceToRect({ maxDistance: 96 }),
    modifiers: [
      restrictToContainer(({ group }) =>
        group === basicGroup ? dragContainerElement : null,
      ),
    ],
    dragOverlay: createDragOverlay,
    onDragStart() {
      clearActiveDropzone();
    },
    onDragUpdate({ activeDropTargetId: nextDropTarget, previousDropTargetId }) {
      updateActiveDropzone(nextDropTarget, previousDropTargetId);
    },
    onDragEnd() {
      clearActiveDropzone();
    },
    onDrop({ draggableId: droppedItemId, dropTargetId }) {
      // Example drop behavior: commit valid drops into app-owned DOM state.
      if (
        droppedItemId !== "draggable" ||
        !isKnownDropTarget(dropTargetId)
      ) {
        return;
      }

      const itemElement = root.querySelector<HTMLElement>(
        '[data-basic-item-id="draggable"]',
      );

      if (!itemElement) {
        return;
      }

      const isSameContainer =
        (dropTargetId === rootContainer.dropTargetId &&
          itemElement.parentElement === rootDropzoneElement) ||
        (dropTargetId === droppableContainer.dropTargetId &&
          itemElement.parentElement === targetDropzoneElement);

      if (isSameContainer) {
        return;
      }

      if (dropTargetId === rootContainer.dropTargetId) {
        rootDropzoneElement.append(itemElement);
      } else if (dropTargetId === droppableContainer.dropTargetId) {
        targetDropzoneElement.append(itemElement);
      }
    },
  });

  const rootDropzoneElement = createDropzone(
    controller,
    rootContainer.dropTargetId,
    rootContainer.label,
  );
  const targetDropzoneElement = createDropzone(
    controller,
    droppableContainer.dropTargetId,
    droppableContainer.label,
  );
  const itemElement = createDraggableItem(controller, "draggable");

  dragContainerElement.append(rootDropzoneElement, targetDropzoneElement);
  root.append(dragContainerElement);
  rootDropzoneElement.append(itemElement);

  return () => {
    clearActiveDropzone();
    dropzoneElements.clear();
    root.replaceChildren();
  };

  // Example rendering: overlay markup is app-owned.
  function createDragOverlay({ dragState }: DragControllerOverlayInput): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "sortableOverlay";
    appendItemContents(overlay, dragState.draggableId, false);

    return overlay;
  }

  // Example styling: active target attributes drive demo CSS highlights.
  function registerDropzoneElement(
    dropTargetId: string,
    element: HTMLElement,
  ): void {
    dropzoneElements.set(dropTargetId, element);

    if (activeDropTargetId === dropTargetId) {
      element.dataset.basicActiveDropTarget = "true";
    } else {
      delete element.dataset.basicActiveDropTarget;
    }
  }

  function clearActiveDropzone(): void {
    setDropzoneActive(activeDropTargetId, false);
    activeDropTargetId = null;
  }

  function updateActiveDropzone(
    nextDropTarget: string | null,
    previousDropTargetId: string | null,
  ): void {
    if (nextDropTarget === previousDropTargetId) {
      return;
    }

    setDropzoneActive(previousDropTargetId, false);
    setDropzoneActive(nextDropTarget, true);
    activeDropTargetId = nextDropTarget;
  }

  function setDropzoneActive(dropTargetId: string | null, active: boolean): void {
    if (!dropTargetId) {
      return;
    }

    const element = dropzoneElements.get(dropTargetId);

    if (!element) {
      return;
    }

    if (active) {
      element.dataset.basicActiveDropTarget = "true";
    } else {
      delete element.dataset.basicActiveDropTarget;
    }
  }

  function createDropzone(
    dragController: DragController,
    dropTargetId: string,
    label: string,
  ): HTMLElement {
    // Example rendering: dropzone markup is app-owned.
    const element = document.createElement("div");
    element.className = "droppableContainer";
    element.dataset.basicDropTargetId = dropTargetId;
    registerDropzoneElement(dropTargetId, element);

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    element.append(labelElement);

    // Package API: registers this DOM node as a drop target.
    createDroppable({
      controller: dragController,
      element,
      dropTargetId,
      group: basicGroup,
    });

    return element;
  }
}

// Example rendering: item markup is app-owned; package helpers wire it to dragging.
function createDraggableItem(
  controller: DragController,
  draggableId: string,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "sortableItem";
  element.dataset.basicItemId = draggableId;

  const handle = document.createElement("button");
  handle.className = "dragListHandle";
  handle.type = "button";
  handle.setAttribute("aria-label", "Drag item");
  handle.textContent = dragHandleText;
  appendItemLabel(element, handle, draggableId);

  // Package API: registers this DOM node and handle as draggable.
  createDraggable({
    controller,
    element,
    draggableId,
    group: basicGroup,
  });
  createDragHandle({ element: handle });

  return element;
}

function appendItemContents(
  element: HTMLElement,
  draggableId: string,
  interactiveHandle: boolean,
): void {
  const handle = interactiveHandle
    ? document.createElement("button")
    : document.createElement("div");
  handle.className = "dragListHandle";
  handle.textContent = dragHandleText;

  if (handle instanceof HTMLButtonElement) {
    handle.type = "button";
    handle.setAttribute("aria-label", "Drag item");
  }

  appendItemLabel(element, handle, draggableId);
}

function appendItemLabel(
  element: HTMLElement,
  handle: HTMLElement,
  draggableId: string,
): void {
  const label = document.createElement("span");
  label.textContent = getDraggableItemLabel(draggableId);

  element.append(handle, label);
}

function getDraggableItemLabel(draggableId: string): string {
  return draggableId === draggableItem.draggableId ? draggableItem.label : "";
}

function isKnownDropTarget(dropTargetId: string): boolean {
  return (
    dropTargetId === rootContainer.dropTargetId ||
    dropTargetId === droppableContainer.dropTargetId
  );
}

