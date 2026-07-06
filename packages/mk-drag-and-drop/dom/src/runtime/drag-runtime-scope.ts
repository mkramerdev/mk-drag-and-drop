import type { DragRect } from "../geometry/rects.js";
import type { DomDraggableRuntime } from "../draggable/create-draggable.js";
import type { DomDropContainerRuntime } from "../droppable/create-drop-container.js";
import type { DomDroppableRuntime } from "../droppable/create-droppable.js";
import type { DomSortableRuntime } from "../sortable/sortable-registry.js";
import { DragRuntime, type StaleDomBindingRecord } from "./drag-runtime.js";
import type {
  DragRuntimeConfigureInput,
  DragRuntimeOptions,
} from "./types.js";

export type DragRuntimeScopeOptions = DragRuntimeOptions;

export type DragRuntimeScopeConfigureInput = DragRuntimeConfigureInput;

export type DragRuntimeScope = DomDraggableRuntime &
  DomDroppableRuntime &
  DomDropContainerRuntime &
  DomSortableRuntime & {
    configure: (input: DragRuntimeScopeConfigureInput) => void;
    cancelDrag: () => void;
    releaseActiveDragResources: () => void;
    setOverlayRect: (overlayRect: DragRect | null) => void;
  };

export type InternalStaleDomBindingRuntime = {
  registerStaleDomBinding: (record: StaleDomBindingRecord) => () => void;
  pruneDisconnectedDomBindings: () => void;
  getStaleDomBindingRecordCount: () => number;
};

export function createDragRuntimeScope(
  options?: DragRuntimeScopeOptions,
): DragRuntimeScope {
  const runtime = new DragRuntime(options);

  const scope: DragRuntimeScope & InternalStaleDomBindingRuntime = {
    configure: (input) => runtime.configure(input),
    cancelDrag: () => runtime.cancelDrag(),
    releaseActiveDragResources: () => runtime.releaseActiveDragResources(),
    setOverlayRect: (overlayRect) => runtime.setOverlayRect(overlayRect),
    requestDragStart: (input) => runtime.requestDragStart(input),
    isKeyboardDragEnabled: () => runtime.isKeyboardDragEnabled(),
    handleSourceKeyboardKeyDown: (input) =>
      runtime.handleSourceKeyboardKeyDown(input),
    registerDropTarget: (dropTargetId, element, group, options) => {
      runtime.registerDropTarget(dropTargetId, element, group, options);
    },
    unregisterDropTarget: (dropTargetId, element) => {
      runtime.unregisterDropTarget(dropTargetId, element);
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
    remeasureDropTargets: (input) => runtime.remeasureDropTargets(input),
    registerStaleDomBinding: (record) => runtime.registerStaleDomBinding(record),
    pruneDisconnectedDomBindings: () => runtime.pruneDisconnectedDomBindings(),
    getStaleDomBindingRecordCount: () =>
      runtime.getStaleDomBindingRecordCount(),
  };

  return scope;
}
