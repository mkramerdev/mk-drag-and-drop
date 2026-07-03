export type DomDroppableRuntime = {
  registerDropTarget: (
    targetId: string,
    element: HTMLElement,
    group: string,
  ) => void;
  unregisterDropTarget: (targetId: string, element?: HTMLElement) => void;
};

export type CreateDomDroppableInput = {
  runtime: DomDroppableRuntime;
  targetId: string;
  group: string;
};

export type DomDroppableBehavior = {
  setElement: (element: HTMLElement | null) => void;
  cleanup: () => void;
};

export function createDomDroppable(
  input: CreateDomDroppableInput,
): DomDroppableBehavior {
  let registeredElement: HTMLElement | null = null;
  let registeredTargetId: string | null = null;

  const cleanup = (): void => {
    if (registeredTargetId !== null) {
      input.runtime.unregisterDropTarget(
        registeredTargetId,
        registeredElement ?? undefined,
      );
    }

    registeredElement = null;
    registeredTargetId = null;
  };

  return {
    setElement: (element) => {
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

      input.runtime.registerDropTarget(input.targetId, element, input.group);
      registeredElement = element;
      registeredTargetId = input.targetId;
    },
    cleanup,
  };
}
