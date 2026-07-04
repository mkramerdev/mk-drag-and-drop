import { domDragHandleAttribute } from "./drag-handle.js";

export type CreateDragHandleInput = {
  element: HTMLElement;
};

export function createDragHandle(input: CreateDragHandleInput): void {
  input.element.setAttribute(domDragHandleAttribute, "true");
}
