import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import {
  createDomSortable,
  type SortableAxis,
  type SortablePlacementBoundary,
} from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "../drag-context.js";

export type UseSortableOptions = {
  draggableId: string;
  group?: string;
  containerId?: string | null;
  axis?: SortableAxis;
  placementBoundary?: SortablePlacementBoundary;
};

export type UseSortableResult = HTMLAttributes<HTMLDivElement> & {
  ref: RefCallback<HTMLDivElement>;
};

const defaultSortableGroup = "default";

export function useSortable({
  draggableId,
  group = defaultSortableGroup,
  containerId = null,
  axis,
  placementBoundary,
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
        draggableId,
        group,
        containerId,
        axis,
        placementBoundary,
        getElement,
      }),
    [
      axis,
      containerId,
      getElement,
      group,
      draggableId,
      keyboardDragEnabled,
      placementBoundary,
      runtime,
    ],
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
