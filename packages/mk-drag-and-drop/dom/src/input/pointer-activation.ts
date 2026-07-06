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

type PendingPointerActivationState = ActivatedPointerDrag & {
  pointerId: number;
  activationTimerId: number | null;
  releasePendingPointerListeners: (() => void) | null;
};

export class PointerActivationController {
  private pendingActivation: PendingPointerActivationState | null = null;

  constructor(private options: PointerActivationControllerOptions) {}

  request(request: PointerDragActivationRequest): void {
    this.cancelPendingActivation();

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
    const pendingActivation: PendingPointerActivationState = {
      draggableId: request.draggableId,
      group: request.group,
      element: request.element,
      pointerId: request.pointerId,
      initialPointerPosition,
      latestPointerPosition: initialPointerPosition,
      activationTimerId: null,
      releasePendingPointerListeners: null,
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

      const distanceX = pointerPosition.x - initialPointerPosition.x;
      const distanceY = pointerPosition.y - initialPointerPosition.y;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      const activationDistanceSquared =
        activationDistance * activationDistance;

      if (distanceSquared >= activationDistanceSquared) {
        this.activatePendingPointerDrag(pendingActivation);
      }
    };

    const handlePointerEnd = (event: PointerEvent): void => {
      if (event.pointerId !== pendingActivation.pointerId) {
        return;
      }

      this.cancelPendingActivation();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    pendingActivation.releasePendingPointerListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };

    this.pendingActivation = pendingActivation;

    if (activationDelay !== null) {
      pendingActivation.activationTimerId = window.setTimeout(() => {
        this.activatePendingPointerDrag(pendingActivation);
      }, activationDelay);
    }
  }

  cancelPendingActivation(): void {
    const pendingActivation = this.pendingActivation;

    if (!pendingActivation) {
      return;
    }

    this.clearPendingActivation(pendingActivation);
  }

  private clearPendingActivation(
    pendingActivation: PendingPointerActivationState,
  ): void {
    if (this.pendingActivation === pendingActivation) {
      this.pendingActivation = null;
    }

    this.clearPendingActivationTimer(pendingActivation);

    const releasePendingPointerListeners =
      pendingActivation.releasePendingPointerListeners;
    pendingActivation.releasePendingPointerListeners = null;
    releasePendingPointerListeners?.();
  }

  private clearPendingActivationTimer(
    pendingActivation: PendingPointerActivationState,
  ): void {
    if (pendingActivation.activationTimerId === null) {
      return;
    }

    window.clearTimeout(pendingActivation.activationTimerId);
    pendingActivation.activationTimerId = null;
  }

  private activatePendingPointerDrag(
    pendingActivation: PendingPointerActivationState,
  ): void {
    if (this.pendingActivation !== pendingActivation) {
      return;
    }

    this.clearPendingActivation(pendingActivation);
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
