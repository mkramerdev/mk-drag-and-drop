import type { DragPoint, DragRect } from "../geometry/rects.js";
import type {
  DropPlacement,
  SortablePlacement,
} from "./drop-target-registry.js";

export type DragStartEvent = {
  draggableId: string;
  pointerPosition: DragPoint;
  sourceRect: DragRect;
};

export type DragUpdateEvent = {
  draggableId: string;
  pointerPosition: DragPoint;
  activeDropTarget: string | null;
  previousDropTarget: string | null;
};

export type DragEndEvent = {
  draggableId: string;
  dropTarget: string | null;
};

export type DropEvent = {
  draggableId: string;
  dropTarget: string;
};

export type DragLifecycleHelpers = {
  getDropPlacement: (draggableId?: string) => DropPlacement | null;
  getSortablePlacement: (draggableId: string) => SortablePlacement | null;
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
};
