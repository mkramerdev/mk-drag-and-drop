import { dragListItems } from "../mock-data";
import { renderDragItem } from "../render-drag-item";

export function rerenderDragItem(itemId: string): HTMLElement | null {
  const item = dragListItems[itemId];
  const currentElement = document.getElementById(itemId);

  if (!item || !currentElement) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = renderDragItem(itemId, item).trim();

  const nextElement = template.content.firstElementChild;

  if (!(nextElement instanceof HTMLElement)) {
    return null;
  }

  currentElement.replaceWith(nextElement);

  return nextElement;
}
