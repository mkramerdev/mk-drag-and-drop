import type { DragOverlayContentRenderer } from "../../dom";
import type { DragListItemPayload } from "./list-data";

export const renderDragListOverlayContent: DragOverlayContentRenderer<
  DragListItemPayload
> = (payload: DragListItemPayload) => {
  const element = document.createElement("div");
  element.className = "dragListItem";

  const dragHandle = document.createElement("div");
  dragHandle.className = "dragListHandle";

  const content = document.createElement("div");
  content.className = "dragListItemText";
  content.textContent = payload.content;

  element.append(dragHandle, content);

  return element;
};
