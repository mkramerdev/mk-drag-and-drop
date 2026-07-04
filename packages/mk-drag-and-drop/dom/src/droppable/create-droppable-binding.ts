import type { DragController } from "../controller/create-drag-controller.js";
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
  const behavior = createDomDroppable({
    runtime: input.controller.runtime,
    targetId: input.targetId,
    containerId: input.containerId ?? null,
    group: input.group ?? defaultDroppableGroup,
  });

  behavior.setElement(input.element);
}
