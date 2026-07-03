import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import { createDomSortable } from "@mk-drag-and-drop/dom";

import { DragContext } from "../drag-context.js";

export type UseSortableOptions = {
  itemId: string;
  group?: string;
};

export type UseSortableResult = HTMLAttributes<HTMLDivElement> & {
  ref: RefCallback<HTMLDivElement>;
};

const defaultSortableGroup = "default";

export function useSortable({
  itemId,
  group = defaultSortableGroup,
}: UseSortableOptions): UseSortableResult {
  const runtime = useContext(DragContext);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  if (!runtime) {
    throw new Error("useSortable must be used inside DragProvider");
  }

  const getElement = useCallback(() => nodeRef.current, []);
  const keyboardDragEnabled = runtime.isKeyboardDragEnabled();
  const behavior = useMemo(
    () =>
      createDomSortable({
        runtime,
        itemId,
        group,
        getElement,
      }),
    [getElement, group, itemId, keyboardDragEnabled, runtime],
  );

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      behavior.setElement(node);
    },
    [behavior],
  );

  return useMemo(() => {
    const sortableProps: UseSortableResult = {
      ref: setNodeRef,
      onPointerDown: behavior.onPointerDown,
    };

    return behavior.tabIndex === undefined
      ? sortableProps
      : {
          ...sortableProps,
          tabIndex: behavior.tabIndex,
          onKeyDown: behavior.onKeyDown,
        };
  }, [behavior, setNodeRef]);
}
