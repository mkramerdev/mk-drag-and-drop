"use client"

import { useEffect, useState } from "react"
import {
  DragProvider,
  useDraggable,
} from "@mk-drag-and-drop/react"

export const basicDragReactCode = `// Package APIs.
import {
  DragProvider,
  useDraggable,
} from "@mk-drag-and-drop/react";

export function Example() {
  return (
    <DragProvider
      dragOverlay={() => {
        // User-provided overlay. The package positions it while dragging.
        return <div>Drag me</div>;
      }}
    >
      <Item />
    </DragProvider>
  );
}

function Item() {
  // Package hook: returns props/ref for the draggable element.
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  });

  // User-owned markup. Spread package props onto the element.
  return <div {...draggable}>Drag me</div>;
}`

export function BasicDragReactDemo() {
  const [dragging, setDragging] = useState(false)

  useActiveDragCursor(dragging)

  return (
    <DragProvider
      dragOverlay={() => <BasicDragItem />}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
    >
      <BasicDragReactItem />
    </DragProvider>
  )
}

function BasicDragReactItem() {
  const draggable = useDraggable<HTMLDivElement>({
    draggableId: "item",
  })

  return (
    <div {...draggable} className={basicDragItemClassName}>
      Drag me
    </div>
  )
}

function BasicDragItem() {
  return <div className={basicDragItemClassName}>Drag me</div>
}

const basicDragItemClassName =
  "inline-flex h-10 w-fit cursor-grab touch-none select-none items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm active:cursor-grabbing"

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
