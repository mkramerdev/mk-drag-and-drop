import type { DragPoint } from "../geometry/rects.js";

import {
  shouldHandleKeyboardDragFromTarget,
  shouldStartDragFromTarget,
} from "../input/drag-handle.js";

export type DomDraggableRuntime = {
  requestDragStart: (input: {
    draggableId: string;
    group: string;
    element: HTMLElement;
    pointerId: number;
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
};

export type DomDraggablePointerDownEvent = {
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
  pointerId: number;
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

      if (
        !shouldStartDragFromTarget({
          draggableElement: element,
          eventTarget: event.target,
        })
      ) {
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
        pointerId: event.pointerId,
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
    tabIndex: input.runtime.isKeyboardDragEnabled() ? 0 : undefined,
  };
}
