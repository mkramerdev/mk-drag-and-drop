import type { DragOverlayContentRenderer } from "../types";
import type { DragOverlayElement } from "./types";

export function appendOverlayContent<Payload>(
    payload: Payload,
    renderContent: DragOverlayContentRenderer<Payload>,
    overlayElement: DragOverlayElement
): DragOverlayElement {

    const overlayContent = renderContent(payload);
    overlayElement.append(overlayContent);

  return overlayElement;
}
