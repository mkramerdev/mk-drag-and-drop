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

export class DragAlreadyActiveError extends Error {
  constructor() {
    super("Cannot start a drag while another drag is active.");
    this.name = "DragAlreadyActiveError";
  }
}

export function createDragRuntime<Payload = unknown>(): DragRuntime<Payload> {
  return {
    isDragging: false,
    draggedKey: null,
    payload: null,
    pointerPosition: null,
    overlayRect: null,
    activeDropTargetKey: null,
  };
}

export function startDrag<Payload>(
  runtime: DragRuntime<Payload>,
  input: StartDragInput<Payload>,
): void {
  if (runtime.isDragging) {
    throw new DragAlreadyActiveError();
  }

  runtime.isDragging = true;
  runtime.draggedKey = input.draggedKey;
  runtime.payload = input.payload;
  runtime.pointerPosition = input.pointerPosition;
  runtime.overlayRect = null;
  runtime.activeDropTargetKey = null;
}

export function moveDrag<Payload>(
  runtime: DragRuntime<Payload>,
  input: MoveDragInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  if (runtime.pointerPosition && runtime.overlayRect) {
    const deltaX = input.pointerPosition.x - runtime.pointerPosition.x;
    const deltaY = input.pointerPosition.y - runtime.pointerPosition.y;

    runtime.overlayRect = translateRect(runtime.overlayRect, deltaX, deltaY);
  }

  runtime.pointerPosition = input.pointerPosition;
}

export function setOverlayRect<Payload>(
  runtime: DragRuntime<Payload>,
  overlayRect: DragRect,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.overlayRect = overlayRect;
}

export function setActiveDropTarget<Payload>(
  runtime: DragRuntime<Payload>,
  input: SetActiveDropTargetInput,
): void {
  if (!runtime.isDragging) {
    return;
  }

  runtime.activeDropTargetKey = input.dropTargetKey;
}

export function endDrag<Payload>(runtime: DragRuntime<Payload>): void {
  runtime.isDragging = false;
  runtime.draggedKey = null;
  runtime.payload = null;
  runtime.pointerPosition = null;
  runtime.overlayRect = null;
  runtime.activeDropTargetKey = null;
}

function translateRect(rect: DragRect, deltaX: number, deltaY: number): DragRect {
  return {
    x: rect.x + deltaX,
    y: rect.y + deltaY,
    width: rect.width,
    height: rect.height,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    left: rect.left + deltaX,
  };
}
