import type { DomDragController } from "./types";

type DomDragControllerState = {
  isActive: boolean;
  isDropTargetRemeasureRequested: boolean;
  requestListeners: Set<() => void>;
};

const controllerStates = new WeakMap<
  DomDragController,
  DomDragControllerState
>();

export function createDomDragController(): DomDragController {
  const controller: DomDragController = {
    requestDropTargetRemeasure: () => {
      const state = controllerStates.get(controller);

      if (!state?.isActive) {
        return;
      }

      state.isDropTargetRemeasureRequested = true;

      for (const listener of state.requestListeners) {
        listener();
      }
    },
  };

  controllerStates.set(controller, {
    isActive: false,
    isDropTargetRemeasureRequested: false,
    requestListeners: new Set(),
  });

  return controller;
}

export function activateDomDragController(
  controller: DomDragController,
): void {
  const state = getDomDragControllerState(controller);

  state.isActive = true;
  state.isDropTargetRemeasureRequested = false;
}

export function deactivateDomDragController(
  controller: DomDragController,
): void {
  const state = getDomDragControllerState(controller);

  state.isActive = false;
  state.isDropTargetRemeasureRequested = false;
  state.requestListeners.clear();
}

export function subscribeToDropTargetRemeasureRequests(
  controller: DomDragController,
  listener: () => void,
): () => void {
  const state = getDomDragControllerState(controller);

  state.requestListeners.add(listener);

  return () => {
    state.requestListeners.delete(listener);
  };
}

export function consumeDropTargetRemeasureRequest(
  controller: DomDragController,
): boolean {
  const state = getDomDragControllerState(controller);

  if (!state.isActive || !state.isDropTargetRemeasureRequested) {
    return false;
  }

  state.isDropTargetRemeasureRequested = false;

  return true;
}

function getDomDragControllerState(
  controller: DomDragController,
): DomDragControllerState {
  const state = controllerStates.get(controller);

  if (!state) {
    throw new Error(
      "Dom drag controllers must be created by createDomDragController.",
    );
  }

  return state;
}
