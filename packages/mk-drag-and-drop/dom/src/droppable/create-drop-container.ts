export type DomDropContainerRuntime = {
  registerDropContainer: (
    containerId: string,
    element: HTMLElement,
    group: string,
    options?: {
      containerId?: string | null;
      container?: boolean;
    },
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
  releaseRegistration: () => void;
};

export function createDomDropContainer(
  input: CreateDomDropContainerInput,
): DomDropContainerBehavior {
  let registeredElementRef: WeakRef<HTMLElement> | null = null;
  let registeredContainerId: string | null = null;

  const releaseRegistration = (): void => {
    const registeredElement = registeredElementRef?.deref() ?? null;

    if (registeredContainerId !== null) {
      input.runtime.unregisterDropContainer(
        registeredContainerId,
        registeredElement ?? undefined,
      );
    }

    registeredElementRef = null;
    registeredContainerId = null;
  };

  const registerElement = (element: HTMLElement): void => {
    input.runtime.registerDropContainer(input.containerId, element, input.group);
    registeredElementRef = new WeakRef(element);
    registeredContainerId = input.containerId;
  };

  const initialElement = input.getElement();

  if (initialElement) {
    registerElement(initialElement);
  }

  return {
    setElement: (element) => {
      const registeredElement = registeredElementRef?.deref() ?? null;

      if (
        element === registeredElement &&
        registeredContainerId === input.containerId
      ) {
        return;
      }

      releaseRegistration();

      if (!element) {
        return;
      }

      registerElement(element);
    },
    releaseRegistration,
  };
}
