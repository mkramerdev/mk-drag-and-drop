import type { Overlay } from "./types";

export function createOverlayWrapper(position: {
    left: number;
    top: number;
    transform?: string;
}): Overlay {
    const overlayWrapper = document.createElement("div");

    overlayWrapper.dataset.dndDragOverlay = "true";
    overlayWrapper.style.position = "fixed";
    overlayWrapper.style.left = `${position.left}px`;
    overlayWrapper.style.top = `${position.top}px`;
    overlayWrapper.style.display = "inline-block";
    overlayWrapper.style.pointerEvents = "none";
    overlayWrapper.style.zIndex = "9999";
    overlayWrapper.style.willChange = "transform";

    if (position.transform) {
        overlayWrapper.style.transform = position.transform;
    }

    return overlayWrapper
}
