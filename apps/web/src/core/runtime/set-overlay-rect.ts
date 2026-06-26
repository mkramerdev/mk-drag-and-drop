import type { DragRect, DragRuntime } from "./types";

export function setOverlayRect<Payload>(
  runtime: DragRuntime<Payload>,
  overlayRect: DragRect,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.overlayRect = overlayRect;
}
