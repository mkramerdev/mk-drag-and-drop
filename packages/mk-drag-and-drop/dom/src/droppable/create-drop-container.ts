export type DomDropContainerRuntime = {
  registerDropContainer: (
    containerId: string,
    element: HTMLElement,
    group: string,
  ) => void;
  unregisterDropContainer: (
    containerId: string,
    element?: HTMLElement,
  ) => void;
};

export type CreateDomDropContainerInput = {
  runtime: DomDropContainerRuntime;
  containerId: string;
  group: string;
  getElement: () => HTMLElement | null;
};

export type DomDropContainerBehavior = {
  setElement: (element: HTMLElement | null) => void;
  cleanup: () => void;
};

export function createDomDropContainer(
  input: CreateDomDropContainerInput,
): DomDropContainerBehavior {
  let registeredElement: HTMLElement | null = null;
  let registeredContainerId: string | null = null;

  const cleanup = (): void => {
    if (registeredContainerId !== null) {
      input.runtime.unregisterDropContainer(
        registeredContainerId,
        registeredElement ?? undefined,
      );
    }

    registeredElement = null;
    registeredContainerId = null;
  };

  const registerElement = (element: HTMLElement): void => {
    input.runtime.registerDropContainer(input.containerId, element, input.group);
    registeredElement = element;
    registeredContainerId = input.containerId;
  };

  const initialElement = input.getElement();

  if (initialElement) {
    registerElement(initialElement);
  }

  return {
    setElement: (element) => {
      if (
        element === registeredElement &&
        registeredContainerId === input.containerId
      ) {
        return;
      }

      cleanup();

      if (!element) {
        return;
      }

      registerElement(element);
    },
    cleanup,
  };
}
