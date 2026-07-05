import type { DragRect } from "../geometry/rects.js";
import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { DomDropContainerRuntime } from "../droppable/create-drop-container.js";
import type { DomDroppableRuntime } from "../droppable/create-droppable.js";
import type { DomSortableRuntime } from "../sortable/sortable-registry.js";
import { DragRuntime, type BindingCleanupRecord } from "./drag-runtime.js";
import type {
  DragRuntimeConfigureInput,
  DragRuntimeOptions,
} from "./types.js";

export type DragRuntimeHandleOptions = DragRuntimeOptions;

export type DragRuntimeHandleConfigureInput = DragRuntimeConfigureInput;

export type DragRuntimeHandle = DomDraggableRuntime &
  DomDroppableRuntime &
  DomDropContainerRuntime &
  DomSortableRuntime & {
    configure: (input: DragRuntimeHandleConfigureInput) => void;
    cleanup: () => void;
    dispose: () => void;
    onDispose: (callback: () => void) => () => void;
    setOverlayRect: (overlayRect: DragRect | null) => void;
  };

export type InternalBindingCleanupRuntime = {
  registerBindingCleanup: (record: BindingCleanupRecord) => () => void;
  pruneDisconnectedBindingCleanups: () => void;
  getBindingCleanupRecordCount: () => number;
};

export function createDragRuntimeHandle(
  options?: DragRuntimeHandleOptions,
): DragRuntimeHandle {
  const runtime = new DragRuntime(options);

  const handle: DragRuntimeHandle & InternalBindingCleanupRuntime = {
    configure: (input) => runtime.configure(input),
    cleanup: () => runtime.cleanup(),
    dispose: () => runtime.dispose(),
    setOverlayRect: (overlayRect) => runtime.setOverlayRect(overlayRect),
    requestDragStart: (input) => runtime.requestDragStart(input),
    isKeyboardDragEnabled: () => runtime.isKeyboardDragEnabled(),
    handleSourceKeyboardKeyDown: (input) =>
      runtime.handleSourceKeyboardKeyDown(input),
    registerDropTarget: (targetId, element, group, options) => {
      runtime.registerDropTarget(targetId, element, group, options);
    },
    unregisterDropTarget: (targetId, element) => {
      runtime.unregisterDropTarget(targetId, element);
    },
    registerDropContainer: (containerId, element, group) => {
      runtime.registerDropContainer(containerId, element, group);
    },
    unregisterDropContainer: (containerId, element) => {
      runtime.unregisterDropContainer(containerId, element);
    },
    getDropTargetRegistration: (dropTargetId, group) =>
      runtime.getDropTargetRegistration(dropTargetId, group),
    subscribe: (subscription) => runtime.subscribe(subscription),
    onDispose: (callback) => runtime.onDispose(callback),
    remeasureDropTargets: (input) => runtime.remeasureDropTargets(input),
    registerBindingCleanup: (record) => runtime.registerBindingCleanup(record),
    pruneDisconnectedBindingCleanups: () =>
      runtime.pruneDisconnectedBindingCleanups(),
    getBindingCleanupRecordCount: () => runtime.getBindingCleanupRecordCount(),
  };

  return handle;
}
