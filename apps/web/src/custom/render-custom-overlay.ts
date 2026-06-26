import type { DragOverlayRenderer } from "../dom/types";
import type { DragListItemPayload } from "./types";

export const renderCustomOverlay: DragOverlayRenderer<DragListItemPayload> = (
    payload: DragListItemPayload
) => {
  const element = document.createElement("div");
  element.className = "dragItem";

  const dragHandle = document.createElement("div");
  dragHandle.className = "dragHandle";

  const content = document.createElement("div");
  content.className = "dragItemText";
  content.textContent = payload.content;

  element.append(dragHandle, content);

  return element;
};