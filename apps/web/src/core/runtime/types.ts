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
  key: string | null;
  payload: Payload | null;
  pointerPosition: DragPoint | null;
  rect: DragRect | null;
  activeDropTargetKey: string | null;
};

export type StartDragInput<Payload = unknown> = {
  key: string;
  payload: Payload;
  pointerPosition: DragPoint;
  rect: DragRect;
};

export type MoveDragInput = {
  pointerPosition: DragPoint;
};

export type SetActiveDropTargetInput = {
  key: string | null;
};