import {
  memo,
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
} & (
  | {
      phase: Extract<DragOverlayPhase, "dragging">;
      removeOverlay?: never;
    }
  | {
      phase: Extract<DragOverlayPhase, "released">;
      removeOverlay: () => void;
    }
);

export type DragOverlayHostHandle = {
  move: (dragState: DragState) => void;
};

export const DragOverlayHost = memo(function DragOverlayHost({
  dragState,
  children,
  contentId,
  onHostReady,
  onOverlayRectChange,
}: {
  dragState: DragState;
  children: ReactNode;
  contentId: number;
  onHostReady?: (host: DragOverlayHostHandle | null) => void;
  onOverlayRectChange?: (overlayRect: DragRect | null) => void;
}) {
  const overlayWrapperRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const wrapper = overlayWrapperRef.current;

    if (!wrapper) {
      onHostReady?.(null);
      return;
    }

    const host = {
      move: (nextDragState: DragState): void => {
        moveOverlayWrapper(wrapper, nextDragState);
      },
    };

    onHostReady?.(host);
    host.move(dragState);

    return () => {
      onHostReady?.(null);
    };
  }, [dragState, onHostReady]);

  useLayoutEffect(() => {
    const wrapper = overlayWrapperRef.current;

    if (!wrapper) {
      onOverlayRectChange?.(null);
      return;
    }

    const measuredElement = wrapper.firstElementChild ?? wrapper;
    const measureOverlayElement = (): void => {
      if (!measuredElement.isConnected) {
        return;
      }

      onOverlayRectChange?.(
        domRectToDragRect(measuredElement.getBoundingClientRect()),
      );
    };

    measureOverlayElement();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        onOverlayRectChange?.(null);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      measureOverlayElement();
    });
    resizeObserver.observe(measuredElement);

    return () => {
      resizeObserver.disconnect();
      onOverlayRectChange?.(null);
    };
  }, [contentId, onOverlayRectChange]);

  return (
    <div
      ref={overlayWrapperRef}
      style={{
        position: "fixed",
        left: dragState.sourceRect.left,
        top: dragState.sourceRect.top,
        width: dragState.sourceRect.width,
        height: dragState.sourceRect.height,
        pointerEvents: "none",
        zIndex: 9999,
        transform: getOverlayTransform(dragState),
      }}
    >
      {children}
    </div>
  );
});

function moveOverlayWrapper(wrapper: HTMLElement, dragState: DragState): void {
  wrapper.style.transform = getOverlayTransform(dragState);
}

function getOverlayTransform(dragState: DragState): string {
  const x = dragState.pointerPosition.x - dragState.startPointerPosition.x;
  const y = dragState.pointerPosition.y - dragState.startPointerPosition.y;

  return `translate3d(${x}px, ${y}px, 0)`;
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
