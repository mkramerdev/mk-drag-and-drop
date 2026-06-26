import type { DragRuntime, StartDragInput } from './types';
import { DragAlreadyActiveError } from './error';

export function startDrag<Payload>(
  runtime: DragRuntime<Payload>,
  input: StartDragInput<Payload>,
): void {
  if (runtime.isDragging) {
    throw new DragAlreadyActiveError();
  }

  runtime.isDragging = true;
  runtime.key = input.key;
  runtime.payload = input.payload;
  runtime.pointerPosition = input.pointerPosition;
  runtime.rect = input.rect;
  runtime.activeDropTargetKey = null;
}