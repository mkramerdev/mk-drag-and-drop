export type DomDroppableRuntime = {
  registerDropTarget: (
    dropTargetId: string,
    element: HTMLElement,
    group: string,
    options?: {
      containerId?: string | null;
    },
  ) => void;
  unregisterDropTarget: (dropTargetId: string, element?: HTMLElement) => void;
};

export type CreateDomDroppableInput = {
  runtime: DomDroppableRuntime;
  dropTargetId: string;
  containerId?: string | null;
  group: string;
};

export type DomDroppableBehavior = {
  setElement: (element: HTMLElement | null) => void;
  releaseRegistration: () => void;
};

export function createDomDroppable(
  input: CreateDomDroppableInput,
): DomDroppableBehavior {
  let registeredElementRef: WeakRef<HTMLElement> | null = null;
  let registeredTargetId: string | null = null;

  const releaseRegistration = (): void => {
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
        registeredTargetId === input.dropTargetId
      ) {
        return;
      }

      releaseRegistration();

      if (!element) {
        return;
      }

      input.runtime.registerDropTarget(
        input.dropTargetId,
        element,
        input.group,
        {
          containerId: input.containerId ?? null,
        },
      );
      registeredElementRef = new WeakRef(element);
      registeredTargetId = input.dropTargetId;
    },
    releaseRegistration,
  };
}
