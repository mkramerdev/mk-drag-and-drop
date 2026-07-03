import type { HTMLAttributes } from "react";

type UseDragHandleReturn<ElementType extends HTMLElement> =
  HTMLAttributes<ElementType> & {
    "data-dnd-drag-handle": string;
  };

const dragHandleProps = {
  "data-dnd-drag-handle": "true",
} as const;

export function useDragHandle<
  ElementType extends HTMLElement = HTMLElement,
>(): UseDragHandleReturn<ElementType> {
  return dragHandleProps as UseDragHandleReturn<ElementType>;
}
