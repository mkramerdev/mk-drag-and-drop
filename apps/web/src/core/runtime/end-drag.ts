import type { DragRuntime } from './types';

export function endDrag<Payload>(runtime: DragRuntime<Payload>): void {
  runtime.isDragging = false;
  runtime.draggedKey = null;
  runtime.payload = null;
  runtime.pointerPosition = null;
  runtime.overlayRect = null;
  runtime.activeDropTargetKey = null;
}
