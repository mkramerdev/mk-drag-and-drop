import type { DragController } from "../controller/create-drag-controller.js";
import { getControllerRuntime } from "../controller/controller-internals.js";
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
  const runtime = getControllerRuntime(input.controller);
  const behavior = createDomDropContainer({
    runtime,
    containerId: input.containerId,
    group: input.group ?? defaultDropContainerGroup,
    getElement: () => elementRef.deref() ?? null,
  });
  runtime.onDispose(() => {
    behavior.cleanup();
  });
}
