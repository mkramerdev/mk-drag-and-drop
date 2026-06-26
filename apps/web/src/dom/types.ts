import type { DragRuntime } from "../core/runtime/types";
import type { TargetingAlgorithm, DropTarget } from '../core/targeting/types';

export type CreateDomDragHandlerOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (key: string) => Payload | null;
  renderOverlay?: DragOverlayRenderer<Payload>;
  targetingAlgorithm?: TargetingAlgorithm;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};

export type DragOverlayRenderer<Payload = unknown> = (payload: Payload) => HTMLElement;

export type DragOverlayController = {
  overlay: HTMLElement;
  sync: () => void;
  destroy: () => void;
};

export type DomDragStartOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (key: string) => Payload | null;
};

export type TrackDomDragInput<Payload> = {
  runtime: DragRuntime<Payload>;
  overlay: DragOverlayController | null;
  dropTargets: readonly DropTarget[];
  targetingAlgorithm: TargetingAlgorithm;
  onDrop?: (drop: { draggedKey: string; dropTargetKey: string }) => void;
};