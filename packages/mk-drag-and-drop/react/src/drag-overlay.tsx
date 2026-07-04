import {
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import type { DragRect } from "@mk-drag-and-drop/dom";
import type {
  DragOverlayPhase,
  DragState,
} from "@mk-drag-and-drop/dom/integration";

export type DragOverlayInput = {
  dragState: DragState;
  phase: DragOverlayPhase;
  finish: () => void;
};

export function DragOverlay({
  dragState,
  children,
  onOverlayRectChange,
}: {
  dragState: DragState;
  children: ReactNode;
  onOverlayRectChange?: (overlayRect: DragRect | null) => void;
}) {
  const overlayWrapperRef = useRef<HTMLDivElement | null>(null);
  const x = dragState.pointerPosition.x - dragState.startPointerPosition.x;
  const y = dragState.pointerPosition.y - dragState.startPointerPosition.y;

  useLayoutEffect(() => {
    const wrapper = overlayWrapperRef.current;

    if (!wrapper) {
      onOverlayRectChange?.(null);
      return;
    }

    const measuredElement = wrapper.firstElementChild ?? wrapper;
    onOverlayRectChange?.(
      domRectToDragRect(measuredElement.getBoundingClientRect()),
    );
  });

  useLayoutEffect(
    () => () => {
      onOverlayRectChange?.(null);
    },
    [onOverlayRectChange],
  );

  return (
    <div
      ref={overlayWrapperRef}
      style={{
        position: "fixed",
        left: dragState.sourceRect.left,
        top: dragState.sourceRect.top,
        width: dragState.sourceRect.width,
        height: dragState.sourceRect.height,
        pointerEvents: "auto",
        zIndex: 9999,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
}

function domRectToDragRect(rect: DOMRectReadOnly): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}
