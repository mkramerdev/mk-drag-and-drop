import type { DragRuntimeHandle } from "../runtime/drag-runtime-handle.js";
import type { DragController } from "./create-drag-controller.js";

const controllerRuntimes = new WeakMap<DragController, DragRuntimeHandle>();

export function setControllerRuntime(
  controller: DragController,
  runtime: DragRuntimeHandle,
): void {
  controllerRuntimes.set(controller, runtime);
}

export function getControllerRuntime(
  controller: DragController,
): DragRuntimeHandle {
  const runtime = controllerRuntimes.get(controller);

  if (!runtime) {
    throw new Error(
      "Unknown drag controller. Create controllers with createDragController before passing them to DOM bindings.",
    );
  }

  return runtime;
}
