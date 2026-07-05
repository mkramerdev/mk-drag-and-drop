import type {
  DragRuntimeHandle,
  InternalBindingCleanupRuntime,
} from "../runtime/drag-runtime-handle.js";
import type { DragController } from "./create-drag-controller.js";

export type DragControllerRuntimeHandle = DragRuntimeHandle &
  InternalBindingCleanupRuntime;

const controllerRuntimes = new WeakMap<
  DragController,
  DragControllerRuntimeHandle
>();

export function setControllerRuntime(
  controller: DragController,
  runtime: DragRuntimeHandle,
): void {
  controllerRuntimes.set(controller, runtime as DragControllerRuntimeHandle);
}

export function getControllerRuntime(
  controller: DragController,
): DragControllerRuntimeHandle {
  const runtime = controllerRuntimes.get(controller);

  if (!runtime) {
    throw new Error(
      "Unknown drag controller. Create controllers with createDragController before passing them to DOM bindings.",
    );
  }

  return runtime;
}
