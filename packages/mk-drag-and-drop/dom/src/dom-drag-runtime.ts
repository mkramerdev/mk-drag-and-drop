import type { DragPoint } from "@mk-drag-and-drop/core";
import type { DomDragRuntime } from "./types.js";

export type StartDomDragRuntimeInput = {
  draggedKey: string;
  pointerPosition: DragPoint;
};

export type MoveDomDragRuntimeInput = {
  pointerPosition: DragPoint;
};

export type SetDomActiveDropTargetInput = {
  dropTargetKey: string | null;
};

export function createDomDragRuntime(): DomDragRuntime {
  return {
    isDragging: false,
    draggedKey: null,
    pointerPosition: null,
    activeDropTargetKey: null,
  };
}

export function startDomDragRuntime(
  runtime: DomDragRuntime,
  input: StartDomDragRuntimeInput,
): boolean {
  if (runtime.isDragging) {
    return false;
  }

  runtime.isDragging = true;
  runtime.draggedKey = input.draggedKey;
  runtime.pointerPosition = input.pointerPosition;
  runtime.activeDropTargetKey = null;

  return true;
}

export function moveDomDragRuntime(
  runtime: DomDragRuntime,
  input: MoveDomDragRuntimeInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.pointerPosition = input.pointerPosition;
}

export function setDomActiveDropTarget(
  runtime: DomDragRuntime,
  input: SetDomActiveDropTargetInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.activeDropTargetKey = input.dropTargetKey;
}

export function endDomDragRuntime(runtime: DomDragRuntime): void {
  runtime.isDragging = false;
  runtime.draggedKey = null;
  runtime.pointerPosition = null;
  runtime.activeDropTargetKey = null;
}
