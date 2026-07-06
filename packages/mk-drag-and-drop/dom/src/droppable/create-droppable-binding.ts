import type { DragController } from "../controller/create-drag-controller.js";
import { getControllerRuntime } from "../controller/controller-internals.js";
import { createDomDroppable } from "./create-droppable.js";

export type CreateDroppableInput = {
  controller: DragController;
  element: HTMLElement;
  dropTargetId: string;
  containerId?: string | null;
  group?: string;
};

const defaultDroppableGroup = "default";

export function createDroppable(input: CreateDroppableInput): void {
  const elementRef = new WeakRef(input.element);
  const runtime = getControllerRuntime(input.controller);
  const behavior = createDomDroppable({
    runtime,
    dropTargetId: input.dropTargetId,
    containerId: input.containerId ?? null,
    group: input.group ?? defaultDroppableGroup,
  });
  let cleanedUp = false;

  behavior.setElement(input.element);

  const releaseDomBinding = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (!elementRef.deref()) {
      return;
    }

    behavior.releaseRegistration();
  };

  runtime.registerStaleDomBinding({
    release: releaseDomBinding,
    isConnected: () => elementRef.deref()?.isConnected === true,
  });
}
