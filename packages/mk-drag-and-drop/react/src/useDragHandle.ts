import type { HTMLAttributes } from "react";

import { domDragHandleAttribute } from "@mk-drag-and-drop/dom";

type UseDragHandleReturn<ElementType extends HTMLElement> =
  HTMLAttributes<ElementType> & {
    "data-dnd-drag-handle": string;
  };

const dragHandleProps = {
  [domDragHandleAttribute]: "true",
} as { "data-dnd-drag-handle": string };

export function useDragHandle<
  ElementType extends HTMLElement = HTMLElement,
>(): UseDragHandleReturn<ElementType> {
  return dragHandleProps as UseDragHandleReturn<ElementType>;
}
