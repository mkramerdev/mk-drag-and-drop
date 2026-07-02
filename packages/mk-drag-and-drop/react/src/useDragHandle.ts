import type { HTMLAttributes } from "react";

type UseDragHandleReturn<ElementType extends HTMLElement> =
  HTMLAttributes<ElementType> & {
    "data-dnd-drag-handle": string;
  };

export function useDragHandle<
  ElementType extends HTMLElement = HTMLElement,
>(): UseDragHandleReturn<ElementType> {
  return {
    "data-dnd-drag-handle": "true",
  };
}
