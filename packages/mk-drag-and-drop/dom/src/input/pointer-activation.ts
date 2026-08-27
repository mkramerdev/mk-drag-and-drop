import type { DragPoint } from "../geometry/rects.js";

import type { NormalizedPointerConfiguration } from "./config.js";
import { globalPointerListenerCapture } from "./global-pointer-listeners.js";

export type PointerDragActivationRequest = {
  draggableId: string;
  group: string;
  element: HTMLElement;
  pointerCaptureTarget?: Element;
  pointerId: number;
  pointerType?: string;
  pointerPosition: DragPoint;
};

export type ActivatedPointerDrag = {
  draggableId: string;
  group: string;
  element: HTMLElement;
  pointerCaptureTarget: Element;
  pointerId: number;
  pointerType: string;
  initialPointerPosition: DragPoint;
  latestPointerPosition: DragPoint;
};

export type PointerActivationControllerOptions = {
  getConfiguration: () => NormalizedPointerConfiguration;
  isDragging: () => boolean;
  acquirePendingResources?: (
    request: PointerDragActivationRequest,
  ) => () => void;
  startImmediately: (request: PointerDragActivationRequest) => void;
  activate: (activation: ActivatedPointerDrag) => void;
};

type PendingPointerActivationState = ActivatedPointerDrag & {
  pointerId: number;
  targetWindow: Window & typeof globalThis;
  activationTimerId: number | null;
  releasePendingPointerListeners: (() => void) | null;
  releasePendingResources: (() => void) | null;
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
    const targetWindow = request.element.ownerDocument.defaultView ?? window;

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
      pointerCaptureTarget: request.pointerCaptureTarget ?? request.element,
      pointerId: request.pointerId,
      pointerType: request.pointerType ?? "",
      initialPointerPosition,
      latestPointerPosition: initialPointerPosition,
      targetWindow,
      activationTimerId: null,
      releasePendingPointerListeners: null,
      releasePendingResources:
        this.options.acquirePendingResources?.(request) ?? null,
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
      const activationDistanceSquared = activationDistance * activationDistance;

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

    targetWindow.addEventListener(
      "pointermove",
      handlePointerMove,
      globalPointerListenerCapture,
    );
    targetWindow.addEventListener(
      "pointerup",
      handlePointerEnd,
      globalPointerListenerCapture,
    );
    targetWindow.addEventListener(
      "pointercancel",
      handlePointerEnd,
      globalPointerListenerCapture,
    );

    pendingActivation.releasePendingPointerListeners = () => {
      targetWindow.removeEventListener(
        "pointermove",
        handlePointerMove,
        globalPointerListenerCapture,
      );
      targetWindow.removeEventListener(
        "pointerup",
        handlePointerEnd,
        globalPointerListenerCapture,
      );
      targetWindow.removeEventListener(
        "pointercancel",
        handlePointerEnd,
        globalPointerListenerCapture,
      );
    };

    this.pendingActivation = pendingActivation;

    if (activationDelay !== null) {
      pendingActivation.activationTimerId = targetWindow.setTimeout(() => {
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

    const releasePendingResources = pendingActivation.releasePendingResources;
    pendingActivation.releasePendingResources = null;
    releasePendingResources?.();
  }

  private clearPendingActivationTimer(
    pendingActivation: PendingPointerActivationState,
  ): void {
    if (pendingActivation.activationTimerId === null) {
      return;
    }

    pendingActivation.targetWindow.clearTimeout(
      pendingActivation.activationTimerId,
    );
    pendingActivation.activationTimerId = null;
  }

  private activatePendingPointerDrag(
    pendingActivation: PendingPointerActivationState,
  ): void {
    if (this.pendingActivation !== pendingActivation) {
      return;
    }

    const releasePendingResources = pendingActivation.releasePendingResources;
    pendingActivation.releasePendingResources = null;
    this.clearPendingActivation(pendingActivation);

    try {
      this.options.activate({
        draggableId: pendingActivation.draggableId,
        group: pendingActivation.group,
        element: pendingActivation.element,
        pointerCaptureTarget: pendingActivation.pointerCaptureTarget,
        pointerId: pendingActivation.pointerId,
        pointerType: pendingActivation.pointerType,
        initialPointerPosition: pendingActivation.initialPointerPosition,
        latestPointerPosition: pendingActivation.latestPointerPosition,
      });
    } finally {
      releasePendingResources?.();
    }
  }
}
