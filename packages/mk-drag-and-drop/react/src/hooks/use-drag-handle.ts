import type { HTMLAttributes } from "react";

import { domDragHandleAttribute } from "@mk-drag-and-drop/dom/integration";

export type UseDragHandleResult<ElementType extends HTMLElement = HTMLElement> =
  HTMLAttributes<ElementType> & {
    "data-dnd-drag-handle": string;
  };

const dragHandleProps = {
  [domDragHandleAttribute]: "true",
} as { "data-dnd-drag-handle": string };

export function useDragHandle<
  ElementType extends HTMLElement = HTMLElement,
>(): UseDragHandleResult<ElementType> {
  return dragHandleProps as UseDragHandleResult<ElementType>;
}
