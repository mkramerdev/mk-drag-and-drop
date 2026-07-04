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

export type UseDraggableResult = HTMLAttributes<HTMLDivElement> & {
  ref: RefCallback<HTMLDivElement>;
};

const defaultDraggableGroup = "default";

export function useDraggable({
  draggableId,
  group = defaultDraggableGroup,
}: UseDraggableOptions): UseDraggableResult {
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
        draggableId,
        group,
        runtime,
        getElement: getNode,
      }),
    [getNode, group, draggableId, keyboardDragEnabled, runtime],
  );

  return useMemo(() => {
    const dragProps: UseDraggableResult = {
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
