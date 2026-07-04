import type { DragController } from "../controller/create-drag-controller.js";
import { createDomDropContainer } from "./create-drop-container.js";

export type CreateDropContainerInput = {
  controller: DragController;
  element: HTMLElement;
  containerId: string;
  group?: string;
};

const defaultDropContainerGroup = "default";

export function createDropContainer(input: CreateDropContainerInput): void {
  const elementRef = new WeakRef(input.element);
  const behavior = createDomDropContainer({
    runtime: input.controller.runtime,
    containerId: input.containerId,
    group: input.group ?? defaultDropContainerGroup,
    getElement: () => elementRef.deref() ?? null,
  });
  input.controller.runtime.onDispose(() => {
    behavior.cleanup();
  });
}
