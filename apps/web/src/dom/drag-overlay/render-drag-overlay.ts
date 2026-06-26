import type { DragRect, DragRuntime } from "../../core/runtime/types";
import type {
  DragOverlayController,
  DragOverlayPlacement,
  DragOverlayContentRenderer,
} from "../types";
import { domRectToDragRect } from "../targeting/dom-rect-to-drag-rect";
import {
  createDragOverlayElement,
  setDragOverlayElementPosition,
} from "./create-drag-overlay-element";
import { appendOverlayContent } from "./append-overlay-content";

export function renderDragOverlay<Payload>(options: {
  renderContent?: DragOverlayContentRenderer<Payload>;
  runtime: DragRuntime<Payload>;
  draggedElementRect: DragRect;
  placement?: DragOverlayPlacement;
}): DragOverlayController | null {
  const renderContent = options.renderContent;
  const payload = options.runtime.payload;
  const startPos = options.runtime.pointerPosition;

  if (!renderContent || !payload || !startPos) {
    return null;
  }

  const initialPosition = getDragOverlayElementPosition(
    options.placement ?? "pointer",
    {
      draggedElementRect: options.draggedElementRect,
      startPos,
    },
  );
  const overlayElement = createDragOverlayElement(initialPosition);
  appendOverlayContent(payload, renderContent, overlayElement);
  document.body.append(overlayElement);

  const measuredOverlayRect = domRectToDragRect(
    overlayElement.getBoundingClientRect(),
  );
  const initialOverlayRect = getInitialOverlayRect(options.placement ?? "pointer", {
    overlayRect: measuredOverlayRect,
    draggedElementRect: options.draggedElementRect,
    startPos,
  });

  setDragOverlayElementPosition(overlayElement, initialOverlayRect);

  return {
    overlayElement,
    initialOverlayRect,
    sync: () => {
      const currentOverlayRect = options.runtime.overlayRect;

      if (!currentOverlayRect) {
        return;
      }

      setDragOverlayElementPosition(overlayElement, currentOverlayRect);
    },
    destroy: () => {
      overlayElement.remove();
    },
  };
}

function getDragOverlayElementPosition(
  placement: DragOverlayPlacement,
  input: {
    draggedElementRect: DragRect;
    startPos: NonNullable<DragRuntime["pointerPosition"]>;
  },
): {
  left: number;
  top: number;
} {
  if (placement === "left-center" || placement === "left-top") {
    return {
      left: input.draggedElementRect.left,
      top: input.draggedElementRect.top,
    };
  }

  return {
    left: input.startPos.x,
    top: input.startPos.y,
  };
}

function getInitialOverlayRect(
  placement: DragOverlayPlacement,
  input: {
    overlayRect: DragRect;
    draggedElementRect: DragRect;
    startPos: NonNullable<DragRuntime["pointerPosition"]>;
  },
): DragRect {
  const position = getInitialOverlayPosition(placement, input);

  return {
    x: position.left,
    y: position.top,
    width: input.overlayRect.width,
    height: input.overlayRect.height,
    top: position.top,
    right: position.left + input.overlayRect.width,
    bottom: position.top + input.overlayRect.height,
    left: position.left,
  };
}

function getInitialOverlayPosition(
  placement: DragOverlayPlacement,
  input: {
    overlayRect: DragRect;
    draggedElementRect: DragRect;
    startPos: NonNullable<DragRuntime["pointerPosition"]>;
  },
): {
  left: number;
  top: number;
} {
  if (placement === "left-center") {
    return {
      left: input.draggedElementRect.left,
      top:
        input.draggedElementRect.top +
        input.draggedElementRect.height / 2 -
        input.overlayRect.height / 2,
    };
  }

  if (placement === "left-top") {
    return {
      left: input.draggedElementRect.left,
      top: input.draggedElementRect.top,
    };
  }

  return {
    left: input.startPos.x,
    top: input.startPos.y,
  };
}
