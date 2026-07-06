import {
  useCallback,
  useContext,
  useEffect,
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

export type UseSortableResult<
  ElementType extends HTMLElement = HTMLElement,
> = HTMLAttributes<ElementType> & {
  ref: RefCallback<ElementType>;
};

const defaultSortableGroup = "default";

export function useSortable<
  ElementType extends HTMLElement = HTMLElement,
>({
  draggableId,
  group = defaultSortableGroup,
  containerId = null,
  axis,
  placementBoundary,
}: UseSortableOptions): UseSortableResult<ElementType> {
  const context = useContext(DragContext);
  const nodeRef = useRef<ElementType | null>(null);

  if (!context) {
    throw new Error("useSortable must be used inside DragProvider");
  }

  const { runtime, keyboardDragEnabled } = context;
  const getElement = useCallback(() => nodeRef.current, []);
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
        keyboardDragEnabled,
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
    (node: ElementType | null) => {
      nodeRef.current = node;
      behavior.setElement(node);
    },
    [behavior],
  );

  useEffect(() => {
    if (nodeRef.current) {
      behavior.setElement(nodeRef.current);
    }

    return () => {
      behavior.releaseRegistration();
    };
  }, [behavior]);

  return useMemo(() => {
    const sortableProps: UseSortableResult<ElementType> = {
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
