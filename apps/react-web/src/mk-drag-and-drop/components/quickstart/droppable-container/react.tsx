"use client"

import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import {
  DragProvider,
  maxOverlayCenterDistanceToRect,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react"

export const droppableContainerReactCode = `import { useState, type ReactNode } from "react";

import {
  DragProvider,
  maxOverlayCenterDistanceToRect,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react";

type ItemLocation = "source" | "drop-zone";

export function Example() {
  // User-owned state: this decides where the item renders.
  const [location, setLocation] = useState<ItemLocation>("source");
  const [dragging, setDragging] = useState(false);

  return (
    <DragProvider
      targetingConstraint={
        // Accept only drops directly on the target.
        maxOverlayCenterDistanceToRect({
          maxDistance: 0,
        })
      }
      dragOverlay={() => {
        // User-provided overlay. The package positions it while dragging.
        return <div>Drag me</div>;
      }}
      onDragStart={() => {
        // New: ghost the original item while dragging.
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDrop={({ dropTargetId }) => {
        // Updated app-owned behavior: either container can receive the item.
        if (dropTargetId === "source" || dropTargetId === "drop-zone") {
          setLocation(dropTargetId);
        }
      }}
    >
      <div>
        <DropZone dropTargetId="source" placeholder="Drop back">
          {location === "source" ? <Item dragging={dragging} /> : null}
        </DropZone>
        <DropZone dropTargetId="drop-zone" placeholder="Drop here">
          {location === "drop-zone" ? (
            <Item dragging={dragging} />
          ) : (
            "Drop here"
          )}
        </DropZone>
      </div>
    </DragProvider>
  );
}

function Item({ dragging }: { dragging: boolean }) {
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  });

  return (
    <div {...draggable} style={{ opacity: dragging ? 0.4 : 1 }}>
      Drag me
    </div>
  );
}

function DropZone({
  dropTargetId,
  placeholder,
  children,
}: {
  dropTargetId: ItemLocation;
  placeholder: string;
  children: ReactNode;
}) {
  const droppable = useDroppable<HTMLDivElement>({
    dropTargetId,
  });

  return <div {...droppable}>{children ?? placeholder}</div>;
}`

type ItemLocation = "source" | "drop-zone"

export function DroppableContainerReactDemo() {
  const [location, setLocation] = useState<ItemLocation>("source")
  const [dragging, setDragging] = useState(false)

  useActiveDragCursor(dragging)

  return (
    <DragProvider
      targetingConstraint={maxOverlayCenterDistanceToRect({
        maxDistance: 0,
      })}
      dragOverlay={() => <DroppableContainerItem dragging={false} />}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      onDrop={({ dropTargetId }) => {
        if (dropTargetId === "source" || dropTargetId === "drop-zone") {
          setLocation(dropTargetId)
        }
      }}
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <DropZone dropTargetId="source" placeholder="Drop back">
          {location === "source" ? (
            <DroppableContainerDraggableItem dragging={dragging} />
          ) : null}
        </DropZone>
        <DropZone dropTargetId="drop-zone" placeholder="Drop here">
          {location === "drop-zone" ? (
            <DroppableContainerDraggableItem dragging={dragging} />
          ) : (
            "Drop here"
          )}
        </DropZone>
      </div>
    </DragProvider>
  )
}

function DroppableContainerDraggableItem({ dragging }: { dragging: boolean }) {
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  })

  return <DroppableContainerItem {...draggable} dragging={dragging} />
}

function DroppableContainerItem({
  dragging,
  ...props
}: ComponentProps<"div"> & { dragging: boolean }) {
  return (
    <div
      {...props}
      className={`${itemClassName} ${dragging ? "opacity-40" : ""}`}
    >
      Drag me
    </div>
  )
}

function DropZone({
  dropTargetId,
  placeholder,
  children,
}: {
  dropTargetId: ItemLocation
  placeholder: string
  children: ReactNode
}) {
  const droppable = useDroppable<HTMLDivElement>({
    dropTargetId,
  })

  return (
    <div {...droppable} className={dropZoneClassName}>
      {children ?? placeholder}
    </div>
  )
}

const itemClassName =
  "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"

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
