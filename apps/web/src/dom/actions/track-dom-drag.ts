import type { DragRuntime } from "../../core/runtime/types";
import type {
  DropTarget,
  TargetingAlgorithm,
} from "../../core/targeting/types";
import type { DragOverlayController } from "../types";

import { onPointerMove } from "./on-pointer-move";
import { releaseDomDrag } from "./release-dom-drag";
import { syncActiveDropTarget } from "./sync-active-droptarget";

export type TrackDomDragInput<Payload> = {
  runtime: DragRuntime<Payload>;
  overlay: DragOverlayController | null;
  dropTargets: readonly DropTarget[];
  targetingAlgorithm: TargetingAlgorithm;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};

export function trackDomDrag<Payload>(
  input: TrackDomDragInput<Payload>,
): void {
  if (!input.runtime.isDragging) {
    return;
  }

  document.documentElement.dataset.dndDragging = "true";

  let activeDropTargetElement: HTMLElement | null = null;

  const handlePointerMove = (event: PointerEvent) => {
    onPointerMove(input, event);

    activeDropTargetElement = syncActiveDropTarget(
      input.runtime.activeDropTargetKey,
      activeDropTargetElement,
    );
  };

  const handlePointerEnd = () => {
    if (!input.runtime.isDragging) {
      return;
    }

    releaseDrag();
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  function releaseDrag(): void {
    removeListeners();
    activeDropTargetElement = releaseDomDrag(input, activeDropTargetElement);
  }

  function removeListeners(): void {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
  }
}
