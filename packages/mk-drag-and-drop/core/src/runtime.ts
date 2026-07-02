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

export type DragRuntime = {
  isDragging: boolean;
  draggedKey: string | null;
  pointerPosition: DragPoint | null;
  activeDropTargetKey: string | null;
};

export type StartDragInput<Payload = unknown> = {
  draggedKey: string;
  payload?: Payload;
  pointerPosition: DragPoint;
};

export type MoveDragInput = {
  pointerPosition: DragPoint;
};

export type SetActiveDropTargetInput = {
  dropTargetKey: string | null;
};

export class DragAlreadyActiveError extends Error {
  constructor() {
    super("Cannot start a drag while another drag is active.");
    this.name = "DragAlreadyActiveError";
  }
}

export function createDragRuntime(): DragRuntime {
  return {
    isDragging: false,
    draggedKey: null,
    pointerPosition: null,
    activeDropTargetKey: null,
  };
}

export function startDrag(
  runtime: DragRuntime,
  input: StartDragInput,
): void {
  if (runtime.isDragging) {
    throw new DragAlreadyActiveError();
  }

  runtime.isDragging = true;
  runtime.draggedKey = input.draggedKey;
  runtime.pointerPosition = input.pointerPosition;
  runtime.activeDropTargetKey = null;
}

export function moveDrag(
  runtime: DragRuntime,
  input: MoveDragInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.pointerPosition = input.pointerPosition;
}

export function setActiveDropTarget(
  runtime: DragRuntime,
  input: SetActiveDropTargetInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.activeDropTargetKey = input.dropTargetKey;
}

export function endDrag(runtime: DragRuntime): void {
  runtime.isDragging = false;
  runtime.draggedKey = null;
  runtime.pointerPosition = null;
  runtime.activeDropTargetKey = null;
}
