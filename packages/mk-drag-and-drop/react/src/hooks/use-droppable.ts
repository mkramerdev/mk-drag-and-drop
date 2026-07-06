import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import { createDomDroppable } from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "../drag-context.js";

export type UseDroppableOptions = {
  dropTargetId: string;
  group?: string;
  containerId?: string | null;
};

export type UseDroppableResult<
  ElementType extends HTMLElement = HTMLElement,
> = HTMLAttributes<ElementType> & {
  ref: RefCallback<ElementType>;
};

const defaultDroppableGroup = "default";

export function useDroppable<
  ElementType extends HTMLElement = HTMLElement,
>({
  dropTargetId,
  group = defaultDroppableGroup,
  containerId = null,
}: UseDroppableOptions): UseDroppableResult<ElementType> {
  const context = useContext(DragContext);
  const nodeRef = useRef<ElementType | null>(null);

  if (!context) {
    throw new Error("useDroppable must be used inside DragProvider");
  }

  const { runtime } = context;
  const behavior = useMemo(
    () =>
      createDomDroppable({
        runtime,
        dropTargetId,
        group,
        containerId,
      }),
    [containerId, dropTargetId, group, runtime],
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

  return useMemo(
    () => ({
      ref: setNodeRef,
    }),
    [setNodeRef],
  );
}
