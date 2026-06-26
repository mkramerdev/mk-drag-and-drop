import type { DragRuntime } from "../../core/runtime/types";
import type { DragOverlayController, DragOverlayRenderer } from "../types";
import { createOverlayWrapper } from "./create-overlay-wrapper";
import { hydrateOverlay } from "./hydrate-overlay";

export function renderDragOverlay<Payload>(options: {
  renderer?: DragOverlayRenderer<Payload>;
  runtime: DragRuntime<Payload>;
}): DragOverlayController | null {

    const renderer = options.renderer;
    const payload = options.runtime.payload;
    const startPos = options.runtime.pointerPosition;
    const rect = options.runtime.rect;
  if (
    !renderer ||
    !payload ||
    !startPos ||
    !rect
  ) {
    return null;
  }
  const overlayWrapper = createOverlayWrapper(rect);
  const overlay = hydrateOverlay(payload, renderer, overlayWrapper);
  document.body.append(overlay);

  return {
    overlay: overlay,
    sync: () => {
      const pointerPosition = options.runtime.pointerPosition;

      if (!pointerPosition) {
        return;
      }

      overlay.style.transform = `translate(${
        pointerPosition.x - startPos.x
      }px, ${pointerPosition.y - startPos.y}px)`;
    },
    destroy: () => {
      overlay.remove();
    },
  };
}
