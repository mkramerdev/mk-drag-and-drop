import type { DragPoint } from "../geometry/rects.js";

import type { NormalizedPointerConfiguration } from "./config.js";

export type PointerDragActivationRequest = {
  draggableId: string;
  group: string;
  element: HTMLElement;
  pointerId: number;
  pointerPosition: DragPoint;
};

export type ActivatedPointerDrag = {
  draggableId: string;
  group: string;
  element: HTMLElement;
  pointerId: number;
  initialPointerPosition: DragPoint;
  latestPointerPosition: DragPoint;
};

export type PointerActivationControllerOptions = {
  getConfiguration: () => NormalizedPointerConfiguration;
  isDragging: () => boolean;
  startImmediately: (request: PointerDragActivationRequest) => void;
  activate: (activation: ActivatedPointerDrag) => void;
};

type PendingPointerActivation = ActivatedPointerDrag & {
  pointerId: number;
  timeoutId: number | null;
  cleanupWindowListeners: () => void;
};

export class PointerActivationController {
  private pendingActivation: PendingPointerActivation | null = null;

  constructor(private options: PointerActivationControllerOptions) {}

  request(request: PointerDragActivationRequest): void {
    this.cancel();

    if (this.options.isDragging()) {
      return;
    }

    const { activationDelay, activationDistance } =
      this.options.getConfiguration();

    if (activationDelay === null && activationDistance === null) {
      this.options.startImmediately(request);
      return;
    }

    const initialPointerPosition = {
      x: request.pointerPosition.x,
      y: request.pointerPosition.y,
    };
    const pendingActivation: PendingPointerActivation = {
      draggableId: request.draggableId,
      group: request.group,
      element: request.element,
      pointerId: request.pointerId,
      initialPointerPosition,
      latestPointerPosition: initialPointerPosition,
      timeoutId: null,
      cleanupWindowListeners: () => {},
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== pendingActivation.pointerId) {
        return;
      }

      const pointerPosition = {
        x: event.clientX,
        y: event.clientY,
      };

      pendingActivation.latestPointerPosition = pointerPosition;

      if (activationDistance === null) {
        return;
      }

      const distance = Math.hypot(
        pointerPosition.x - initialPointerPosition.x,
        pointerPosition.y - initialPointerPosition.y,
      );

      if (distance >= activationDistance) {
        this.activatePending(pendingActivation);
      }
    };

    const handlePointerEnd = (event: PointerEvent): void => {
      if (event.pointerId !== pendingActivation.pointerId) {
        return;
      }

      this.cancel();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    pendingActivation.cleanupWindowListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };

    if (activationDelay !== null) {
      pendingActivation.timeoutId = window.setTimeout(() => {
        this.activatePending(pendingActivation);
      }, activationDelay);
    }

    this.pendingActivation = pendingActivation;
  }

  cancel(): void {
    const pendingActivation = this.pendingActivation;

    if (!pendingActivation) {
      return;
    }

    if (pendingActivation.timeoutId !== null) {
      window.clearTimeout(pendingActivation.timeoutId);
    }

    pendingActivation.cleanupWindowListeners();
    this.pendingActivation = null;
  }

  private activatePending(pendingActivation: PendingPointerActivation): void {
    if (this.pendingActivation !== pendingActivation) {
      return;
    }

    this.cancel();
    this.options.activate({
      draggableId: pendingActivation.draggableId,
      group: pendingActivation.group,
      element: pendingActivation.element,
      pointerId: pendingActivation.pointerId,
      initialPointerPosition: pendingActivation.initialPointerPosition,
      latestPointerPosition: pendingActivation.latestPointerPosition,
    });
  }
}
