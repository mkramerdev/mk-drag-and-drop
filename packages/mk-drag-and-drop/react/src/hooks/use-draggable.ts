import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import { createDomDraggable } from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "../drag-context.js";

export type UseDraggableOptions = {
  draggableId: string;
  group?: string;
};

export type UseDraggableResult<
  ElementType extends HTMLElement = HTMLElement,
> = HTMLAttributes<ElementType> & {
  ref: RefCallback<ElementType>;
};

const defaultDraggableGroup = "default";

export function useDraggable<
  ElementType extends HTMLElement = HTMLElement,
>({
  draggableId,
  group = defaultDraggableGroup,
}: UseDraggableOptions): UseDraggableResult<ElementType> {
  const context = useContext(DragContext);
  const nodeRef = useRef<ElementType | null>(null);

  if (!context) {
    throw new Error("useDraggable must be used inside DragProvider");
  }

  const { runtime, keyboardDragEnabled } = context;
  const setNodeRef = useCallback((node: ElementType | null) => {
    nodeRef.current = node;
  }, []);
  const getNode = useCallback(() => nodeRef.current, []);
  const behavior = useMemo(
    () =>
      createDomDraggable({
        draggableId,
        group,
        runtime,
        getElement: getNode,
        keyboardDragEnabled,
      }),
    [getNode, group, draggableId, keyboardDragEnabled, runtime],
  );

  return useMemo(() => {
    const dragProps: UseDraggableResult<ElementType> = {
      ref: setNodeRef,
      onPointerDown: behavior.onPointerDown,
    };

    return behavior.tabIndex !== undefined
      ? {
          ...dragProps,
          tabIndex: behavior.tabIndex,
          onKeyDown: behavior.onKeyDown,
        }
      : dragProps;
  }, [behavior, setNodeRef]);
}
