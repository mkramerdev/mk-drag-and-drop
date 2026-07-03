import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type HTMLAttributes,
  type RefCallback,
} from "react";

import { createDomDroppable } from "@mk-drag-and-drop/dom";

import { DragContext } from "../drag-context.js";

type UseDroppableItem = {
  targetId: string;
  group?: string;
};

type UseDroppableReturn = HTMLAttributes<HTMLDivElement> & {
  ref: RefCallback<HTMLDivElement>;
};

const defaultDroppableGroup = "default";

export function useDroppable({
  targetId,
  group = defaultDroppableGroup,
}: UseDroppableItem): UseDroppableReturn {
  const runtime = useContext(DragContext);

  if (!runtime) {
    throw new Error("useDroppable must be used inside DragProvider");
  }

  const behavior = useMemo(
    () =>
      createDomDroppable({
        runtime,
        targetId,
        group,
      }),
    [group, runtime, targetId],
  );

  useEffect(
    () => () => {
      behavior.cleanup();
    },
    [behavior],
  );

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      behavior.setElement(node);
    },
    [behavior],
  );

  return useMemo(
    () => ({
      ref: setNodeRef,
    }),
    [setNodeRef],
  );
}
