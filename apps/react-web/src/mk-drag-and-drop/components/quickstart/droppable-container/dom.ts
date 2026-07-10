import {
  createDragController,
  createDraggable,
  createDroppable,
  maxOverlayCenterDistanceToRect,
} from "@mk-drag-and-drop/dom"

export const droppableContainerDomCode = `// Package APIs.
import {
  createDragController,
  createDraggable,
  createDroppable,
  maxOverlayCenterDistanceToRect,
} from "@mk-drag-and-drop/dom";

const itemElement = document.createElement("div");
itemElement.textContent = "Drag me";

const sourceElement = document.createElement("div");
const dropZoneElement = document.createElement("div");
dropZoneElement.textContent = "Drop here";
sourceElement.append(itemElement);

const controller = createDragController({
  // Accept only drops directly on the target.
  targetingConstraint: maxOverlayCenterDistanceToRect({
    maxDistance: 0,
  }),
  dragOverlay() {
    const overlayElement = document.createElement("div");
    overlayElement.textContent = "Drag me";
    return overlayElement;
  },
  onDragStart() {
    // New: ghost the original item while dragging.
    itemElement.style.opacity = "0.4";
  },
  onDragEnd() {
    itemElement.style.opacity = "";
  },
  onDrop({ dropTargetId }) {
    // Updated app-owned behavior: either container can receive the item.
    if (dropTargetId === "source") {
      sourceElement.textContent = "";
      dropZoneElement.textContent = "Drop here";
      sourceElement.append(itemElement);
    }

    if (dropTargetId === "drop-zone") {
      sourceElement.textContent = "Drop back";
      dropZoneElement.textContent = "";
      dropZoneElement.append(itemElement);
    }
  },
});

createDraggable({
  controller,
  element: itemElement,
  draggableId: "item",
});

// New: the source container is droppable too, so the item can move back.
createDroppable({
  controller,
  element: sourceElement,
  dropTargetId: "source",
});

createDroppable({
  controller,
  element: dropZoneElement,
  dropTargetId: "drop-zone",
});

document.body.append(sourceElement, dropZoneElement);`

export type MountedDroppableContainerDomDemo = {
  destroy: () => void
}

export function mountDroppableContainerDomDemo(
  hostElement: HTMLElement
): MountedDroppableContainerDomDemo {
  const sourceElement = document.createElement("div")
  sourceElement.className = getDropZoneClassName()

  const dropZoneElement = document.createElement("div")
  dropZoneElement.className = getDropZoneClassName()

  const itemElement = createDroppableContainerItemElement()
  moveItemTo({
    itemElement,
    sourceElement,
    dropZoneElement,
    dropTargetId: "source",
  })

  let restoreCursor: (() => void) | null = null

  const controller = createDragController({
    targetingConstraint: maxOverlayCenterDistanceToRect({
      maxDistance: 0,
    }),
    dragOverlay() {
      return createDroppableContainerItemElement()
    },
    onDragStart() {
      itemElement.classList.add("opacity-40")
      restoreCursor = setGlobalDragCursor()
    },
    onDragEnd() {
      itemElement.classList.remove("opacity-40")
      restoreCursor?.()
      restoreCursor = null
    },
    onDrop({ dropTargetId }) {
      if (dropTargetId !== "source" && dropTargetId !== "drop-zone") return

      moveItemTo({
        itemElement,
        sourceElement,
        dropZoneElement,
        dropTargetId,
      })
    },
  })

  createDraggable({
    controller,
    element: itemElement,
    draggableId: "item",
  })

  createDroppable({
    controller,
    element: sourceElement,
    dropTargetId: "source",
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

function moveItemTo({
  itemElement,
  sourceElement,
  dropZoneElement,
  dropTargetId,
}: {
  itemElement: HTMLElement
  sourceElement: HTMLElement
  dropZoneElement: HTMLElement
  dropTargetId: "source" | "drop-zone"
}) {
  sourceElement.replaceChildren()
  dropZoneElement.replaceChildren()

  if (dropTargetId === "source") {
    sourceElement.append(itemElement)
    dropZoneElement.textContent = "Drop here"
    return
  }

  sourceElement.textContent = "Drop back"
  dropZoneElement.append(itemElement)
}

function createDroppableContainerItemElement() {
  const itemElement = document.createElement("div")
  itemElement.textContent = "Drag me"
  itemElement.className = getItemClassName()
  return itemElement
}

function getItemClassName() {
  return "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"
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
