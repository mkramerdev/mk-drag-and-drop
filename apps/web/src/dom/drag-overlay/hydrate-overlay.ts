import type { DragOverlayRenderer } from "../types";
import type { Overlay } from "./types";

export function hydrateOverlay<Payload>(
    payload: Payload,
    renderer: DragOverlayRenderer<Payload>,
    overlayWrapper: Overlay
): HTMLDivElement {

    const overlayContent = renderer(payload);
    overlayWrapper.append(overlayContent);

  return overlayWrapper;
}
