import {
  createDragController,
  createDraggable,
} from "@mk-drag-and-drop/dom"

export const basicDragDomCode = `// Package APIs.
import {
  createDragController,
  createDraggable,
} from "@mk-drag-and-drop/dom";

// User-owned DOM element.
const itemElement = document.createElement("div");
itemElement.textContent = "Drag me";

const controller = createDragController({
  dragOverlay() {
    // User-provided overlay. The package positions it while dragging.
    const overlayElement = document.createElement("div");
    overlayElement.textContent = "Drag me";
    return overlayElement;
  },
});

// Package registration: make the user-owned element draggable.
createDraggable({
  controller,
  element: itemElement,
  draggableId: "item",
});

// User-owned DOM placement.
document.body.append(itemElement);`

export type MountedBasicDragDomDemo = {
  destroy: () => void
}

export function mountBasicDragDomDemo(
  hostElement: HTMLElement
): MountedBasicDragDomDemo {
  const itemElement = createBasicDragItemElement()

  let restoreCursor: (() => void) | null = null

  const controller = createDragController({
    dragOverlay() {
      return createBasicDragItemElement()
    },
    onDragStart() {
      restoreCursor = setGlobalDragCursor()
    },
    onDragEnd() {
      restoreCursor?.()
      restoreCursor = null
    },
  })

  createDraggable({
    controller,
    element: itemElement,
    draggableId: "item",
  })

  hostElement.replaceChildren(itemElement)

  return {
    destroy() {
      restoreCursor?.()
      restoreCursor = null
      hostElement.replaceChildren()
    },
  }
}

function createBasicDragItemElement() {
  const itemElement = document.createElement("div")
  itemElement.textContent = "Drag me"
  itemElement.className = getBasicDragItemClassName()
  return itemElement
}

function getBasicDragItemClassName() {
  return "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"
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
