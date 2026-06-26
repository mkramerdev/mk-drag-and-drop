import type { DragRuntime, SetActiveDropTargetInput } from './types';

export function setActiveDropTarget<Payload>(
  runtime: DragRuntime<Payload>,
  input: SetActiveDropTargetInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.activeDropTargetKey = input.dropTargetKey;
}
