export type DomDroppableRuntime = {
  registerDropTarget: (
    targetId: string,
    element: HTMLElement,
    group: string,
    options?: {
      containerId?: string | null;
    },
  ) => void;
  unregisterDropTarget: (targetId: string, element?: HTMLElement) => void;
};

export type CreateDomDroppableInput = {
  runtime: DomDroppableRuntime;
  targetId: string;
  containerId?: string | null;
  group: string;
};

export type DomDroppableBehavior = {
  setElement: (element: HTMLElement | null) => void;
  cleanup: () => void;
};

export function createDomDroppable(
  input: CreateDomDroppableInput,
): DomDroppableBehavior {
  let registeredElementRef: WeakRef<HTMLElement> | null = null;
  let registeredTargetId: string | null = null;

  const cleanup = (): void => {
    const registeredElement = registeredElementRef?.deref() ?? null;

    if (registeredTargetId !== null) {
      input.runtime.unregisterDropTarget(
        registeredTargetId,
        registeredElement ?? undefined,
      );
    }

    registeredElementRef = null;
    registeredTargetId = null;
  };

  return {
    setElement: (element) => {
      const registeredElement = registeredElementRef?.deref() ?? null;

      if (
        element === registeredElement &&
        registeredTargetId === input.targetId
      ) {
        return;
      }

      cleanup();

      if (!element) {
        return;
      }

      input.runtime.registerDropTarget(input.targetId, element, input.group, {
        containerId: input.containerId ?? null,
      });
      registeredElementRef = new WeakRef(element);
      registeredTargetId = input.targetId;
    },
    cleanup,
  };
}
