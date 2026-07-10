import {
  createDragController,
  createDraggable,
  createDroppable,
} from "@mk-drag-and-drop/dom"

export const singleDroppableDomCode = `// Package APIs.
import {
  createDragController,
  createDraggable,
  createDroppable,
} from "@mk-drag-and-drop/dom";

const itemElement = document.createElement("div");
itemElement.textContent = "Drag me";

const sourceElement = document.createElement("div");
const dropZoneElement = document.createElement("div");
dropZoneElement.textContent = "Drop here";
sourceElement.append(itemElement);

const controller = createDragController({
  dragOverlay() {
    const overlayElement = document.createElement("div");
    overlayElement.textContent = "Drag me";
    return overlayElement;
  },
  onDrop({ dropTargetId }) {
    // User-owned drop behavior. The package only reports the target.
    if (dropTargetId !== "drop-zone") return;

    dropZoneElement.textContent = "";
    dropZoneElement.append(itemElement);
  },
});

createDraggable({
  controller,
  element: itemElement,
  draggableId: "item",
});

// New package registration: make the destination container droppable.
createDroppable({
  controller,
  element: dropZoneElement,
  dropTargetId: "drop-zone",
});

document.body.append(sourceElement, dropZoneElement);`

export type MountedSingleDroppableDomDemo = {
  destroy: () => void
}

export function mountSingleDroppableDomDemo(
  hostElement: HTMLElement
): MountedSingleDroppableDomDemo {
  const sourceElement = document.createElement("div")
  sourceElement.className = getPlainContainerClassName()

  const dropZoneElement = document.createElement("div")
  dropZoneElement.className = getDropZoneClassName()
  dropZoneElement.textContent = "Drop here"

  const itemElement = createSingleDroppableItemElement()
  sourceElement.append(itemElement)

  let restoreCursor: (() => void) | null = null

  const controller = createDragController({
    dragOverlay() {
      return createSingleDroppableItemElement()
    },
    onDragStart() {
      restoreCursor = setGlobalDragCursor()
    },
    onDragEnd() {
      restoreCursor?.()
      restoreCursor = null
    },
    onDrop({ dropTargetId }) {
      if (dropTargetId !== "drop-zone") return
      dropZoneElement.replaceChildren(itemElement)
    },
  })

  createDraggable({
    controller,
    element: itemElement,
    draggableId: "item",
  })

  createDroppable({
    controller,
    element: dropZoneElement,
    dropTargetId: "drop-zone",
  })

  hostElement.replaceChildren(sourceElement, dropZoneElement)

  return {
    destroy() {
      restoreCursor?.()
      restoreCursor = null
      hostElement.replaceChildren()
    },
  }
}

function createSingleDroppableItemElement() {
  const itemElement = document.createElement("div")
  itemElement.textContent = "Drag me"
  itemElement.className = getItemClassName()
  return itemElement
}

function getItemClassName() {
  return "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"
}

function getPlainContainerClassName() {
  return "flex h-24 w-40 items-center justify-center rounded-md border border-border bg-background/60 p-3"
}

function getDropZoneClassName() {
  return "flex h-24 w-40 items-center justify-center rounded-md border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground"
}

function setGlobalDragCursor() {
  const root = document.documentElement
  const body = document.body
  const previousRootCursor = root.style.cursor
  const previousBodyCursor = body.style.cursor

  root.style.cursor = "grabbing"
  body.style.cursor = "grabbing"

  return () => {
    root.style.cursor = previousRootCursor
    body.style.cursor = previousBodyCursor
  }
}
