import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  type RefCallback,
} from "react";

import {
  createDomDropContainer,
  type DomDropContainerBehavior,
} from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "../drag-context.js";

export type UseDropContainerOptions = {
  containerId: string;
  group?: string;
};

export type UseDropContainerResult = {
  ref: RefCallback<HTMLDivElement>;
};

const defaultDropContainerGroup = "default";

export function useDropContainer({
  containerId,
  group = defaultDropContainerGroup,
}: UseDropContainerOptions): UseDropContainerResult {
  const runtime = useContext(DragContext);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const behaviorRef = useRef<{
    runtime: typeof runtime;
    containerId: string;
    group: string;
    behavior: DomDropContainerBehavior;
  } | null>(null);

  if (!runtime) {
    throw new Error("useDropContainer must be used inside DragProvider");
  }

  const getElement = useCallback(() => nodeRef.current, []);
  const getBehavior = useCallback((): DomDropContainerBehavior => {
    const existingBehavior = behaviorRef.current;

    if (
      existingBehavior &&
      existingBehavior.runtime === runtime &&
      existingBehavior.containerId === containerId &&
      existingBehavior.group === group
    ) {
      return existingBehavior.behavior;
    }

    existingBehavior?.behavior.cleanup();

    const behavior = createDomDropContainer({
      runtime,
      containerId,
      group,
      getElement,
    });

    behaviorRef.current = {
      runtime,
      containerId,
      group,
      behavior,
    };

    return behavior;
  }, [containerId, getElement, group, runtime]);

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      getBehavior().setElement(node);
    },
    [getBehavior],
  );

  useEffect(() => {
    const behavior = getBehavior();

    if (nodeRef.current) {
      behavior.setElement(nodeRef.current);
    }

    return () => {
      behavior.cleanup();

      if (behaviorRef.current?.behavior === behavior) {
        behaviorRef.current = null;
      }
    };
  }, [getBehavior]);

  return {
    ref: setNodeRef,
  };
}
