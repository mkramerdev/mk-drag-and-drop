"use client"

import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import {
  DragProvider,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react"

export const singleDroppableReactCode = `import { useState, type ReactNode } from "react";

// Package APIs.
import {
  DragProvider,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react";

type ItemLocation = "source" | "drop-zone";

export function Example() {
  const [location, setLocation] = useState<ItemLocation>("source");

  return (
    <DragProvider
      dragOverlay={() => <div>Drag me</div>}
      onDrop={({ dropTargetId }) => {
        // User-owned drop behavior. The package only reports the target.
        if (dropTargetId === "drop-zone") {
          setLocation("drop-zone");
        }
      }}
    >
      <div>
        <div>{location === "source" ? <Item /> : null}</div>
        <DropZone>
          {location === "drop-zone" ? <Item /> : "Drop here"}
        </DropZone>
      </div>
    </DragProvider>
  );
}

function Item() {
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  });

  return <div {...draggable}>Drag me</div>;
}

function DropZone({ children }: { children: ReactNode }) {
  // New package hook: make the destination container droppable.
  const droppable = useDroppable<HTMLDivElement>({
    dropTargetId: "drop-zone",
  });

  return <div {...droppable}>{children}</div>;
}`

type ItemLocation = "source" | "drop-zone"

export function SingleDroppableReactDemo() {
  const [location, setLocation] = useState<ItemLocation>("source")
  const [dragging, setDragging] = useState(false)

  useActiveDragCursor(dragging)

  return (
    <DragProvider
      dragOverlay={() => <SingleDroppableItem />}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      onDrop={({ dropTargetId }) => {
        if (dropTargetId === "drop-zone") {
          setLocation("drop-zone")
        }
      }}
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className={plainContainerClassName}>
          {location === "source" ? <SingleDroppableDraggableItem /> : null}
        </div>
        <DropZone>
          {location === "drop-zone" ? (
            <SingleDroppableDraggableItem />
          ) : (
            "Drop here"
          )}
        </DropZone>
      </div>
    </DragProvider>
  )
}

function SingleDroppableDraggableItem() {
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  })

  return <SingleDroppableItem {...draggable} />
}

function SingleDroppableItem(props: ComponentProps<"div">) {
  return (
    <div {...props} className={itemClassName}>
      Drag me
    </div>
  )
}

function DropZone({ children }: { children: ReactNode }) {
  const droppable = useDroppable<HTMLDivElement>({
    dropTargetId: "drop-zone",
  })

  return (
    <div {...droppable} className={dropZoneClassName}>
      {children}
    </div>
  )
}

const itemClassName =
  "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"

const plainContainerClassName =
  "flex h-24 w-40 items-center justify-center rounded-md border border-border bg-background/60 p-3"

const dropZoneClassName =
  "flex h-24 w-40 items-center justify-center rounded-md border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground"

function useActiveDragCursor(active: boolean) {
  useEffect(() => {
    if (!active) return

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
  }, [active])
}
