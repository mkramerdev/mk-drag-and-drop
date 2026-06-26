import type { DragRect } from "../../core/runtime/types";
import type { Overlay } from "./types";

export function createOverlayWrapper(rect: DragRect): Overlay {
    const overlayWrapper = document.createElement("div");
    const startRect = rect;

    overlayWrapper.dataset.dndDragOverlay = "true";
    overlayWrapper.style.position = "fixed";
    overlayWrapper.style.left = `${startRect.left}px`;
    overlayWrapper.style.top = `${startRect.top}px`;
    overlayWrapper.style.width = `${startRect.width / 2}px`;
    overlayWrapper.style.pointerEvents = "none";
    overlayWrapper.style.zIndex = "9999";
    overlayWrapper.style.willChange = "transform";

    return overlayWrapper
}