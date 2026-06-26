export type DragPoint = {
  x: number;
  y: number;
};

export type DragRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DragRuntime<Payload = unknown> = {
  isDragging: boolean;
  draggedKey: string | null;
  payload: Payload | null;
  pointerPosition: DragPoint | null;
  overlayRect: DragRect | null;
  activeDropTargetKey: string | null;
};

export type StartDragInput<Payload = unknown> = {
  draggedKey: string;
  payload: Payload;
  pointerPosition: DragPoint;
};

export type MoveDragInput = {
  pointerPosition: DragPoint;
};

export type SetActiveDropTargetInput = {
  dropTargetKey: string | null;
};
