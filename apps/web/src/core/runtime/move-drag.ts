import type { DragRuntime, MoveDragInput } from './types';
import { translateRect } from './helpers/translate-rect';

export function moveDrag<Payload>(
  runtime: DragRuntime<Payload>,
  input: MoveDragInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  if (runtime.pointerPosition && runtime.overlayRect) {
    const deltaX = input.pointerPosition.x - runtime.pointerPosition.x;
    const deltaY = input.pointerPosition.y - runtime.pointerPosition.y;

    runtime.overlayRect = translateRect(runtime.overlayRect, deltaX, deltaY);
  }

  runtime.pointerPosition = input.pointerPosition;
}
