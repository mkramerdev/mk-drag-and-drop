import type { ReactNode } from "react";

import type {
  DragOverlayPhase,
  DragState,
} from "@mk-drag-and-drop/dom";

export type DragOverlayInput = {
  phase: DragOverlayPhase;
  finish: () => void;
};

export function DragOverlay({
  dragState,
  children,
}: {
  dragState: DragState;
  children: ReactNode;
}) {
  const x = dragState.pointerPosition.x - dragState.startPointerPosition.x;
  const y = dragState.pointerPosition.y - dragState.startPointerPosition.y;

  return (
    <div
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
