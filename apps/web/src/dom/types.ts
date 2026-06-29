import type {
  DropTarget,
  DragPoint,
  DragRect,
  DragRuntime,
  TargetingAlgorithm,
} from "../core";

export type CreateDomDragHandlerOptions<Payload> = {
  runtime: DragRuntime<Payload>;
  getPayload: (draggedKey: string) => Payload | null;
  getDraggedElement?: (
    draggedKey: string,
    dragHandle: HTMLElement,
  ) => HTMLElement | null;
  renderOverlayContent?: DragOverlayContentRenderer<Payload>;
  overlayPlacement?: DragOverlayPlacement;
  targetingAlgorithm?: TargetingAlgorithm;
  getDropTargets?: DomDropTargetCollector<Payload>;
  remeasureDropTargetsOnDragUpdate?: boolean;
  onDragStart?: (drag: DomDragStartEvent<Payload>) => void;
  onDragUpdate?: (drag: DomDragUpdateEvent<Payload>) => void;
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

export type DomDragUpdateEvent<Payload> = {
  draggedKey: string;
  payload: Payload;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  activeDropTargetKey: string | null;
  previousDropTargetKey: string | null;
  remeasureDropTargets: () => void;
};

export type DomDropTargetCollectionContext<Payload> = {
  draggedKey: string;
  payload: Payload;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
};

export type DomDropTargetCollector<Payload> = (
  parent: ParentNode,
  context: DomDropTargetCollectionContext<Payload>,
) => readonly DropTarget[];

export type DragOverlayContentRenderer<Payload = unknown> = (
  payload: Payload,
) => HTMLElement;

export type DragOverlayPlacement = "pointer" | "left-center" | "left-top";
