import type { DragRect, DragRuntime } from "../core";
import type {
  DragOverlayContentRenderer,
  DragOverlayPlacement,
} from "./types";
import { domRectToDragRect } from "./geometry";

type DragOverlayElement = HTMLDivElement;

export type DragOverlayController = {
  overlayElement: DragOverlayElement;
  initialOverlayRect: DragRect;
  sync: () => void;
  destroy: () => void;
};

export function renderDragOverlay<Payload>(options: {
  renderContent?: DragOverlayContentRenderer<Payload>;
  runtime: DragRuntime<Payload>;
  draggedElementRect: DragRect;
  placement?: DragOverlayPlacement;
}): DragOverlayController | null {
  const renderContent = options.renderContent;
  const payload = options.runtime.payload;
  const startPos = options.runtime.pointerPosition;

  if (!renderContent || payload === null || !startPos) {
    return null;
  }

  const placement = options.placement ?? "pointer";
  const initialPosition = getDragOverlayElementPosition(placement, {
    draggedElementRect: options.draggedElementRect,
    startPos,
  });
  const overlayElement = createDragOverlayElement(initialPosition);
  appendOverlayContent(payload, renderContent, overlayElement);
  document.body.append(overlayElement);

  const measuredOverlayRect = domRectToDragRect(
    overlayElement.getBoundingClientRect(),
  );
  const initialOverlayRect = getInitialOverlayRect(placement, {
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

function createDragOverlayElement(position: {
  left: number;
  top: number;
}): DragOverlayElement {
  const overlayElement = document.createElement("div");

  overlayElement.dataset.dndDragOverlay = "true";
  overlayElement.style.position = "fixed";
  overlayElement.style.display = "inline-block";
  overlayElement.style.pointerEvents = "none";
  overlayElement.style.zIndex = "9999";
  overlayElement.style.willChange = "left, top";
  setDragOverlayElementPosition(overlayElement, position);

  return overlayElement;
}

function appendOverlayContent<Payload>(
  payload: Payload,
  renderContent: DragOverlayContentRenderer<Payload>,
  overlayElement: DragOverlayElement,
): DragOverlayElement {
  const overlayContent = renderContent(payload);
  overlayElement.append(overlayContent);

  return overlayElement;
}

function setDragOverlayElementPosition(
  overlayElement: DragOverlayElement,
  position: {
    left: number;
    top: number;
  },
): void {
  overlayElement.style.left = `${position.left}px`;
  overlayElement.style.top = `${position.top}px`;
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
