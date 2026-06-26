import type { DragRuntime } from './types';

export function endDrag<Payload>(runtime: DragRuntime<Payload>): void {
  runtime.isDragging = false;
  runtime.key = null;
  runtime.payload = null;
  runtime.pointerPosition = null;
  runtime.rect = null;
  runtime.activeDropTargetKey = null;
}