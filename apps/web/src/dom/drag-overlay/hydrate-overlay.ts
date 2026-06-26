import type { DragOverlayRenderer } from "../types";
import type { Overlay } from "./types";

export function hydrateOverlay<Payload>(
    payload: Payload,
    renderer: DragOverlayRenderer<Payload>,
    overlayWrapper: Overlay
): Overlay {

    const overlay = overlayWrapper;
    const overlayContent = renderer(payload);
    overlayWrapper.append(overlayContent);

  return overlay;
}
