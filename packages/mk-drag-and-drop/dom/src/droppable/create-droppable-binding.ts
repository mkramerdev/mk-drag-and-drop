import type { DragController } from "../controller/create-drag-controller.js";
import { getControllerRuntime } from "../controller/controller-internals.js";
import { createDomDroppable } from "./create-droppable.js";

export type CreateDroppableInput = {
  controller: DragController;
  element: HTMLElement;
  targetId: string;
  containerId?: string | null;
  group?: string;
};

const defaultDroppableGroup = "default";

export function createDroppable(input: CreateDroppableInput): void {
  const runtime = getControllerRuntime(input.controller);
  const behavior = createDomDroppable({
    runtime,
    targetId: input.targetId,
    containerId: input.containerId ?? null,
    group: input.group ?? defaultDroppableGroup,
  });

  behavior.setElement(input.element);
  runtime.onDispose(() => {
    behavior.cleanup();
  });
}
