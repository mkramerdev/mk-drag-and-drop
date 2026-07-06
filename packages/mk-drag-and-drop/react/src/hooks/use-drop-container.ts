import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefCallback,
} from "react";

import {
  createDomDropContainer,
  type DomDropContainerBehavior,
  type DragRuntimeScope,
} from "@mk-drag-and-drop/dom/integration";

import { DragContext } from "../drag-context.js";

export type UseDropContainerOptions = {
  containerId: string;
  group?: string;
};

export type UseDropContainerResult<
  ElementType extends HTMLElement = HTMLElement,
> = {
  ref: RefCallback<ElementType>;
};

const defaultDropContainerGroup = "default";

export function useDropContainer<
  ElementType extends HTMLElement = HTMLElement,
>({
  containerId,
  group = defaultDropContainerGroup,
}: UseDropContainerOptions): UseDropContainerResult<ElementType> {
  const context = useContext(DragContext);
  const nodeRef = useRef<ElementType | null>(null);
  const behaviorRef = useRef<{
    runtime: DragRuntimeScope;
    containerId: string;
    group: string;
    behavior: DomDropContainerBehavior;
  } | null>(null);

  if (!context) {
    throw new Error("useDropContainer must be used inside DragProvider");
  }

  const { runtime } = context;

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

    existingBehavior?.behavior.releaseRegistration();

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
    (node: ElementType | null) => {
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
      behavior.releaseRegistration();

      if (behaviorRef.current?.behavior === behavior) {
        behaviorRef.current = null;
      }
    };
  }, [getBehavior]);

  return useMemo(
    () => ({
      ref: setNodeRef,
    }),
    [setNodeRef],
  );
}
