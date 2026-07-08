import type { DragPoint, DragRect } from "../geometry/rects.js";
import type { SortableDropPlacement } from "./drop-target-registry.js";

export type DragSource = "pointer" | "keyboard";

export type DragEndResult =
  | "dropped"
  | "no-target"
  | "invalid-target"
  | "canceled";

export type DragStartEvent = {
  draggableId: string;
  source: DragSource;
  pointerPosition: DragPoint;
  sourceRect: DragRect;
};

export type DragUpdateEvent = {
  draggableId: string;
  source: DragSource;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  activeDropTargetId: string | null;
  previousDropTargetId: string | null;
};

export type DragEndEvent = {
  draggableId: string;
  source: DragSource;
  result: DragEndResult;
  overlayRect: DragRect | null;
  dropTargetId: string | null;
};

export type DropEvent = {
  draggableId: string;
  source: DragSource;
  dropTargetId: string;
  sortablePlacement?: SortableDropPlacement;
};

export type ActiveDragResetEvent = {
  draggableId: string;
  source: DragSource;
};

export type DragLifecycleHelpers = {
  getDropTargetRect: (dropTargetId: string) => DragRect | null;
};

export type DragLifecycleCallbacks = {
  onDragStart?: (
    event: DragStartEvent,
    helpers: DragLifecycleHelpers,
  ) => void;
  onDragUpdate?: (
    event: DragUpdateEvent,
    helpers: DragLifecycleHelpers,
  ) => void;
  onDragEnd?: (event: DragEndEvent, helpers: DragLifecycleHelpers) => void;
  onDrop?: (event: DropEvent, helpers: DragLifecycleHelpers) => void;
};

export type DragRuntimeSubscription = {
  onDragStart?: (event: DragStartEvent) => void;
  onDragUpdate?: (event: DragUpdateEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDrop?: (event: DropEvent) => void;
  onActiveDragReset?: (event: ActiveDragResetEvent) => void;
};
