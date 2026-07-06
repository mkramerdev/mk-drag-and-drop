import type {
  DragRuntimeScope,
  InternalStaleDomBindingRuntime,
} from "../runtime/drag-runtime-scope.js";
import type { DragController } from "./create-drag-controller.js";

export type DragControllerRuntimeScope = DragRuntimeScope &
  InternalStaleDomBindingRuntime;

const controllerRuntimes = new WeakMap<
  DragController,
  DragControllerRuntimeScope
>();

export function setControllerRuntime(
  controller: DragController,
  runtime: DragRuntimeScope,
): void {
  controllerRuntimes.set(controller, runtime as DragControllerRuntimeScope);
}

export function getControllerRuntime(
  controller: DragController,
): DragControllerRuntimeScope {
  const runtime = controllerRuntimes.get(controller);

  if (!runtime) {
    throw new Error(
      "Unknown drag controller. Create controllers with createDragController before passing them to DOM bindings.",
    );
  }

  return runtime;
}
