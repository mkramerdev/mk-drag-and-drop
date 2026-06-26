import type { DragRuntime } from './types';

export function createDragRuntime<Payload = unknown>(): DragRuntime<Payload> {
  return {
    isDragging: false,
    key: null,
    payload: null,
    pointerPosition: null,
    rect: null,
    activeDropTargetKey: null,
  };
}