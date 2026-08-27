import type { DragPoint } from "../geometry/rects.js";

import {
  getPointerCaptureTarget,
  shouldHandleKeyboardDragFromTarget,
} from "../input/drag-handle.js";

export type DomDraggableRuntime = {
  requestDragStart: (input: {
    draggableId: string;
    group: string;
    element: HTMLElement;
    pointerCaptureTarget?: Element;
    pointerId: number;
    pointerType?: string;
    pointerPosition: DragPoint;
  }) => void;
  isKeyboardDragEnabled: () => boolean;
  handleSourceKeyboardKeyDown: (input: {
    draggableId: string;
    group: string;
    element: HTMLElement;
    key: string;
  }) => boolean;
};

export type CreateDomDraggableInput = {
  runtime: DomDraggableRuntime;
  draggableId: string;
  group: string;
  getElement: () => HTMLElement | null;
  keyboardDragEnabled?: boolean;
};

export type DomDraggablePointerDownEvent = {
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
  pointerId: number;
  pointerType?: string;
  button?: number;
  isPrimary?: boolean;
  clientX: number;
  clientY: number;
};

export type DomDraggableKeyDownEvent = {
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
  key: string;
};

export type DomDraggableBehavior = {
  onPointerDown: (event: DomDraggablePointerDownEvent) => void;
  onKeyDown: (event: DomDraggableKeyDownEvent) => void;
  tabIndex: 0 | undefined;
};

export function createDomDraggable(
  input: CreateDomDraggableInput,
): DomDraggableBehavior {
  return {
    onPointerDown: (event) => {
      const element = input.getElement();

      if (!element) {
        return;
      }

      const pointerCaptureTarget = getPointerCaptureTarget({
        draggableElement: element,
        eventTarget: event.target,
      });

      if (!pointerCaptureTarget) {
        return;
      }

      if (
        event.isPrimary === false ||
        (event.button !== undefined && event.button !== 0)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      input.runtime.requestDragStart({
        draggableId: input.draggableId,
        group: input.group,
        element,
        pointerCaptureTarget,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        pointerPosition: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    },
    onKeyDown: (event) => {
      const element = input.getElement();

      if (
        !element ||
        !shouldHandleKeyboardDragFromTarget({
          draggableElement: element,
          eventTarget: event.target,
        })
      ) {
        return;
      }

      const handled = input.runtime.handleSourceKeyboardKeyDown({
        draggableId: input.draggableId,
        group: input.group,
        element,
        key: event.key,
      });

      if (!handled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    tabIndex:
      input.keyboardDragEnabled ?? input.runtime.isKeyboardDragEnabled()
        ? 0
        : undefined,
  };
}
