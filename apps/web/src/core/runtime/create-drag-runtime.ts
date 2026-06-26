import type { DragRuntime } from './types';

export function createDragRuntime<Payload = unknown>(): DragRuntime<Payload> {
  return {
    isDragging: false,
    draggedKey: null,
    payload: null,
    pointerPosition: null,
    overlayRect: null,
    activeDropTargetKey: null,
  };
}
