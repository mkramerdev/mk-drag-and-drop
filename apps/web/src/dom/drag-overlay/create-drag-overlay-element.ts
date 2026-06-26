import type { DragOverlayElement } from "./types";

export function createDragOverlayElement(position: {
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

export function setDragOverlayElementPosition(
    overlayElement: DragOverlayElement,
    position: {
        left: number;
        top: number;
    },
): void {
    overlayElement.style.left = `${position.left}px`;
    overlayElement.style.top = `${position.top}px`;
}
