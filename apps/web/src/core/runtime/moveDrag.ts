import type { DragRuntime, MoveDragInput } from './types';
import { translateRect } from './helpers/translateRect';

export function moveDrag<Payload>(
  runtime: DragRuntime<Payload>,
  input: MoveDragInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  if (runtime.pointerPosition && runtime.rect) {
    const deltaX = input.pointerPosition.x - runtime.pointerPosition.x;
    const deltaY = input.pointerPosition.y - runtime.pointerPosition.y;

    runtime.rect = translateRect(runtime.rect, deltaX, deltaY);
  }

  runtime.pointerPosition = input.pointerPosition;
}