import type { DragController } from "../controller/create-drag-controller.js";
import { createDomDropContainer } from "./create-drop-container.js";

export type CreateDropContainerInput = {
  controller: DragController;
  element: HTMLElement;
  containerId: string;
  group?: string;
};

export type CreateDropContainerCleanup = () => void;

const defaultDropContainerGroup = "default";

export function createDropContainer(
  input: CreateDropContainerInput,
): CreateDropContainerCleanup {
  const behavior = createDomDropContainer({
    runtime: input.controller.runtime,
    containerId: input.containerId,
    group: input.group ?? defaultDropContainerGroup,
    getElement: () => input.element,
  });
  let disposeCleanup: (() => void) | null = null;
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    behavior.cleanup();

    const unsubscribe = disposeCleanup;
    disposeCleanup = null;
    unsubscribe?.();
  };

  disposeCleanup = input.controller.runtime.onDispose(cleanup);

  return cleanup;
}
