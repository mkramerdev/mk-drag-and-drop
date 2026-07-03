import type { DragController } from "../controller/create-drag-controller.js";
import { createDomDroppable } from "./create-droppable.js";

export type CreateDroppableInput = {
  controller: DragController;
  element: HTMLElement;
  targetId: string;
  group?: string;
};

export type CreateDroppableCleanup = () => void;

const defaultDroppableGroup = "default";

export function createDroppable(
  input: CreateDroppableInput,
): CreateDroppableCleanup {
  const behavior = createDomDroppable({
    runtime: input.controller.runtime,
    targetId: input.targetId,
    group: input.group ?? defaultDroppableGroup,
  });
  let disposeCleanup: (() => void) | null = null;
  let cleanedUp = false;

  behavior.setElement(input.element);

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
