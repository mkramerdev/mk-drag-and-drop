import type { DragRect, DragRuntime } from "../core/runtime/types";
import type { TargetingAlgorithm, DropTarget } from '../core/targeting/types';
import type { DragOverlayElement } from "./drag-overlay/types";

export type CreateDomDragHandlerOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (draggedKey: string) => Payload | null;
  renderOverlayContent?: DragOverlayContentRenderer<Payload>;
  overlayPlacement?: DragOverlayPlacement;
  targetingAlgorithm?: TargetingAlgorithm;
  onDragStart?: (drag: DomDragStartEvent<Payload>) => void;
  onDragEnd?: (drag: DomDragEndEvent<Payload>) => void;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};

export type DomDragStartEvent<Payload> = {
  draggedKey: string;
  payload: Payload;
};

export type DomDragEndEvent<Payload> = {
  draggedKey: string;
  payload: Payload;
  dropTargetKey: string | null;
};

export type DragOverlayContentRenderer<Payload = unknown> = (
  payload: Payload,
) => HTMLElement;

export type DragOverlayPlacement = "pointer" | "left-center" | "left-top";

export type DragOverlayController = {
  overlayElement: DragOverlayElement;
  initialOverlayRect: DragRect;
  sync: () => void;
  destroy: () => void;
};

export type DomDragStartOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (draggedKey: string) => Payload | null;
};

export type DomDragStartResult<Payload> = {
  draggedKey: string;
  payload: Payload;
  draggedElementRect: DragRect;
  pointerCapture: DomPointerCapture;
};

export type DomPointerCapture = {
  element: HTMLElement;
  pointerId: number;
  previousCursor: string;
};

export type TrackDomDragInput<Payload> = {
  runtime: DragRuntime<Payload>;
  overlay: DragOverlayController | null;
  dropTargets: readonly DropTarget[];
  pointerCapture: DomPointerCapture;
  targetingAlgorithm: TargetingAlgorithm;
  onDragEnd?: (drag: DomDragEndEvent<Payload>) => void;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};
