import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import { createDomDraggable } from "@mk-drag-and-drop/dom";

import { DragContext } from "../drag-context.js";

type UseDraggableItem = {
  itemId: string;
  group?: string;
};

type UseDraggableReturn = HTMLAttributes<HTMLDivElement> & {
  ref: RefCallback<HTMLDivElement>;
};

const defaultDraggableGroup = "default";

export function useDraggable({
  itemId,
  group = defaultDraggableGroup,
}: UseDraggableItem): UseDraggableReturn {
  const runtime = useContext(DragContext);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  if (!runtime) {
    throw new Error("useDraggable must be used inside DragProvider");
  }

  const setNodeRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
  }, []);
  const getNode = useCallback(() => nodeRef.current, []);
  const keyboardDragEnabled = runtime.isKeyboardDragEnabled();
  const behavior = useMemo(
    () =>
      createDomDraggable({
        itemId,
        group,
        runtime,
        getElement: getNode,
      }),
    [getNode, group, itemId, keyboardDragEnabled, runtime],
  );

  return useMemo(() => {
    const dragProps: UseDraggableReturn = {
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
