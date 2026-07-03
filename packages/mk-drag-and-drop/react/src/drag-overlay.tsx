import {
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import {
  rectToDragRect,
  type DragOverlayPhase,
  type DragRect,
  type DragState,
} from "@mk-drag-and-drop/dom";

export type DragOverlayInput = {
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
      rectToDragRect(measuredElement.getBoundingClientRect()),
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
