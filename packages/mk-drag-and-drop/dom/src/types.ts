import type {
  DragPoint,
  DragRect,
  TargetingAlgorithm,
  TargetingConstraint,
} from "@mk-drag-and-drop/core";

export type DomPointerDownEvent = {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  pointerId: number;
  clientX: number;
  clientY: number;
};

export type DomDragHandler = (event: DomPointerDownEvent) => void;

export type DomDragSession = {
  dropTargets: Map<string, DragRect>;
  activeDropTargetKey: string | null;
  requestDropTargetRetarget: (() => void) | null;
};

export type DomDragRuntime = {
  isDragging: boolean;
  draggedKey: string | null;
  pointerPosition: DragPoint | null;
  activeDropTargetKey: string | null;
};

export type DomDragControls = {
  readonly pointerPosition: DragPoint | null;
  recalculateTargets: (overlayRect?: DragRect | null) => void;
};

export type CreateDomDragHandlerOptions = {
  runtime: DomDragRuntime;
  session: DomDragSession;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
  onDragStart?: (drag: DomDragStartEvent, controls: DomDragControls) => void;
  onDragUpdate?: (drag: DomDragUpdateEvent, controls: DomDragControls) => void;
  onDragEnd?: (drag: DomDragEndEvent, controls: DomDragControls) => void;
  onDrop?: (drop: DomDropEvent, controls: DomDragControls) => void;
};

export type DomDragStartEvent = {
  draggedKey: string;
};

export type DomDragEndEvent = {
  draggedKey: string;
  dropTargetKey: string | null;
};

export type DomDragUpdateEvent = {
  draggedKey: string;
  pointerPosition: DragPoint;
  activeDropTargetKey: string | null;
  previousDropTargetKey: string | null;
};

export type DomDropEvent = {
  draggedKey: string;
  dropTargetKey: string;
};
