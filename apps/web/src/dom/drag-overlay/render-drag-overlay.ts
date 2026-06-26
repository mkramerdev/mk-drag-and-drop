import type { DragRuntime } from "../../core/runtime/types";
import type {
  DragOverlayController,
  DragOverlayPlacement,
  DragOverlayRenderer,
} from "../types";
import { createOverlayWrapper } from "./create-overlay-wrapper";
import { hydrateOverlay } from "./hydrate-overlay";

export function renderDragOverlay<Payload>(options: {
  renderer?: DragOverlayRenderer<Payload>;
  runtime: DragRuntime<Payload>;
  placement?: DragOverlayPlacement;
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
  const initialPosition = getOverlayWrapperPosition(
    options.placement ?? "pointer",
    {
      rect,
      startPos,
    },
  );
  const overlayWrapper = createOverlayWrapper(initialPosition);
  const overlay = hydrateOverlay(payload, renderer, overlayWrapper);
  document.body.append(overlay);

  return {
    overlay: overlay,
    sync: () => {
      const pointerPosition = options.runtime.pointerPosition;

      if (!pointerPosition) {
        return;
      }

      overlay.style.transform = getOverlayTransform(
        initialPosition.transform,
        pointerPosition.x - startPos.x,
        pointerPosition.y - startPos.y,
      );
    },
    destroy: () => {
      overlay.remove();
    },
  };
}

function getOverlayWrapperPosition(
  placement: DragOverlayPlacement,
  input: {
    rect: NonNullable<DragRuntime["rect"]>;
    startPos: NonNullable<DragRuntime["pointerPosition"]>;
  },
): {
  left: number;
  top: number;
  transform?: string;
} {
  if (placement === "left-center") {
    return {
      left: input.rect.left,
      top: input.rect.top + input.rect.height / 2,
      transform: "translateY(-50%)",
    };
  }

  if (placement === "left-top") {
    return {
      left: input.rect.left,
      top: input.rect.top,
    };
  }

  return {
    left: input.startPos.x,
    top: input.startPos.y,
  };
}

function getOverlayTransform(
  baseTransform: string | undefined,
  deltaX: number,
  deltaY: number,
): string {
  const dragTransform = `translate(${deltaX}px, ${deltaY}px)`;

  return baseTransform ? `${baseTransform} ${dragTransform}` : dragTransform;
}
