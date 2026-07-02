import { DragContext, type DragRuntime } from "./drag-provider";
import {
    useContext,
    useCallback,
    useRef,
    type HTMLAttributes,
    type PointerEventHandler,
    type RefCallback,
} from "react";

export type UseSortableOptions = {
    itemId: string;
    group?: string;
};

export type UseSortableResult =
    HTMLAttributes<HTMLDivElement> & {
        ref: RefCallback<HTMLDivElement>;
};

const dragHandleSelector = "[data-dnd-drag-handle]";
const sortableItemSelector = "[data-dnd-sortable-item]";

type SortableRegistry = {
    elements: Map<string, HTMLElement>;
    groups: Map<string, string>;
    snapshots: Map<string, SortableSnapshot>;
};

type SortableSnapshot = {
    element: HTMLElement;
    parent: HTMLElement;
    nextSibling: ChildNode | null;
};

const sortableRegistries = new WeakMap<DragRuntime, SortableRegistry>();
const defaultSortableGroup = "default";

export function useSortable({
    itemId,
    group = defaultSortableGroup,
}: UseSortableOptions): UseSortableResult {
    const runtime = useContext(DragContext);
    const nodeRef = useRef<HTMLDivElement | null>(null);
    const registeredItemIdRef = useRef<string | null>(null);

    if (!runtime) {
        throw new Error("useSortable must be used inside DragProvider");
    }

    const registry = getSortableRegistry(runtime);

    const setNodeRef = useCallback(
        (node: HTMLDivElement | null) => {
            unregisterSortableElement({
                registry,
                runtime,
                itemId: registeredItemIdRef.current,
                element: nodeRef.current,
            });

            nodeRef.current = node;

            if (!node) {
                registeredItemIdRef.current = null;
                return;
            }

            node.dataset.dndSortableItem = "true";
            registry.elements.set(itemId, node);
            registry.groups.set(itemId, group);
            registeredItemIdRef.current = itemId;
            registerSortableDropTarget(runtime, itemId, node, group);
        },
        [group, itemId, registry, runtime],
    );

    return {
      ref: setNodeRef,
      onPointerDown: createDragHandler(
        itemId,
        group,
        runtime,
        registry,
        () => nodeRef.current,
      ),
    };
}

function createDragHandler(
    itemId: string,
    group: string,
    runtime: DragRuntime,
    registry: SortableRegistry,
    getNode: () => HTMLDivElement | null,
): PointerEventHandler<HTMLDivElement> {

    return (event) => {
        const node = getNode();
        if (!node) return;
        if (!shouldStartDragFromEvent(node, event)) return;

        event.preventDefault();
        refreshSortableDropTargets(registry, runtime);

        const rect = node.getBoundingClientRect();

        runtime.startDrag({
            itemId,
            group,
            pointerPosition: {
                x: event.clientX,
                y: event.clientY,
            },
            sourceRect: domRectToDragRect(rect),
        });
    };
  }

function shouldStartDragFromEvent(
    sortableElement: HTMLElement,
    event: Parameters<PointerEventHandler<HTMLDivElement>>[0],
): boolean {
    if (!(event.target instanceof Element)) {
        return false;
    }

    const closestSortable = event.target.closest(sortableItemSelector);

    if (closestSortable !== sortableElement) {
        return false;
    }

    const hasDragHandle = sortableElement.querySelector(dragHandleSelector) !== null;

    if (!hasDragHandle) {
        return true;
    }

    const closestDragHandle = event.target.closest(dragHandleSelector);

    return closestDragHandle !== null && sortableElement.contains(closestDragHandle);
}

function getSortableRegistry(runtime: DragRuntime): SortableRegistry {
    const existingRegistry = sortableRegistries.get(runtime);

    if (existingRegistry) {
        return existingRegistry;
    }

    const registry: SortableRegistry = {
        elements: new Map(),
        groups: new Map(),
        snapshots: new Map(),
    };

    runtime.subscribe({
        onDragStart: (event) => {
            snapshotSortableElement(registry, event.itemId);
        },
        onDragUpdate: (event) => {
            if (
                !shouldMoveSortablePreview({
                    draggedItemId: event.itemId,
                    activeDropTarget: event.activeDropTarget,
                    previousDropTarget: event.previousDropTarget,
                })
            ) {
                return;
            }

            moveSortablePreview({
                registry,
                runtime,
                draggedItemId: event.itemId,
                activeDropTarget: event.activeDropTarget,
            });
        },
        onDragEnd: (event) => {
            if (event.dropTarget === null) {
                restoreSortableSnapshot(registry, event.itemId);
                refreshSortableDropTargets(registry, runtime);
            }

            clearSortableDraggedState(registry, event.itemId);
            registry.snapshots.delete(event.itemId);
        },
        onDrop: (event) => {
            clearSortableDraggedState(registry, event.itemId);
            registry.snapshots.delete(event.itemId);
            refreshSortableDropTargets(registry, runtime);
        },
    });

    sortableRegistries.set(runtime, registry);

    return registry;
}

function unregisterSortableElement(input: {
    registry: SortableRegistry;
    runtime: DragRuntime;
    itemId: string | null;
    element: HTMLElement | null;
}): void {
    if (input.itemId !== null) {
        input.runtime.unregisterDropTarget(input.itemId);

        if (input.registry.elements.get(input.itemId) === input.element) {
            input.registry.elements.delete(input.itemId);
            input.registry.groups.delete(input.itemId);
        }
    }

    if (input.element) {
        delete input.element.dataset.dndSortableItem;
        delete input.element.dataset.dndDragged;
    }
}

function snapshotSortableElement(
    registry: SortableRegistry,
    itemId: string,
): void {
    const element = registry.elements.get(itemId);

    if (!element?.parentElement) {
        return;
    }

    element.dataset.dndDragged = "true";
    registry.snapshots.set(itemId, {
        element,
        parent: element.parentElement,
        nextSibling: element.nextSibling,
    });
}

function shouldMoveSortablePreview(input: {
    draggedItemId: string;
    activeDropTarget: string | null;
    previousDropTarget: string | null;
}): boolean {
    return (
        input.activeDropTarget !== null &&
        input.activeDropTarget !== input.previousDropTarget &&
        input.activeDropTarget !== input.draggedItemId
    );
}

function moveSortablePreview(input: {
    registry: SortableRegistry;
    runtime: DragRuntime;
    draggedItemId: string;
    activeDropTarget: string | null;
}): void {
    if (
        input.activeDropTarget === null ||
        input.activeDropTarget === input.draggedItemId
    ) {
        return;
    }

    const draggedElement = input.registry.elements.get(input.draggedItemId);
    const targetElement = input.registry.elements.get(input.activeDropTarget);
    const listElement = draggedElement?.parentElement ?? targetElement?.parentElement;

    if (
        !draggedElement ||
        !targetElement ||
        !listElement ||
        draggedElement.parentElement !== listElement ||
        targetElement.parentElement !== listElement
    ) {
        return;
    }

    const sortableElements = getSortableItemChildren(listElement);
    const draggedIndex = sortableElements.indexOf(draggedElement);
    const targetIndex = sortableElements.indexOf(targetElement);

    if (
        draggedIndex === -1 ||
        targetIndex === -1 ||
        draggedIndex === targetIndex
    ) {
        return;
    }

    if (draggedIndex < targetIndex) {
        targetElement.after(draggedElement);
    } else {
        targetElement.before(draggedElement);
    }

    refreshSortableDropTargets(input.registry, input.runtime);
}

function restoreSortableSnapshot(
    registry: SortableRegistry,
    itemId: string,
): void {
    const snapshot = registry.snapshots.get(itemId);

    if (!snapshot || snapshot.element.parentElement !== snapshot.parent) {
        return;
    }

    if (snapshot.nextSibling?.parentNode === snapshot.parent) {
        snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
        return;
    }

    snapshot.parent.append(snapshot.element);
}

function clearSortableDraggedState(
    registry: SortableRegistry,
    itemId: string,
): void {
    const element =
        registry.elements.get(itemId) ?? registry.snapshots.get(itemId)?.element;

    if (element) {
        delete element.dataset.dndDragged;
    }
}

function refreshSortableDropTargets(
    registry: SortableRegistry,
    runtime: DragRuntime,
): void {
    for (const [itemId, element] of registry.elements) {
        const group = registry.groups.get(itemId);

        if (group) {
            registerSortableDropTarget(runtime, itemId, element, group);
        }
    }
}

function registerSortableDropTarget(
    runtime: DragRuntime,
    itemId: string,
    element: HTMLElement,
    group: string,
): void {
    runtime.registerDropTarget(itemId, element, group);
}

function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
    return Array.from(listElement.children).filter(
        (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            child.dataset.dndSortableItem !== undefined,
    );
}

function domRectToDragRect(rect: DOMRect): {
    x: number;
    y: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
} {
    return {
        x: rect.x,
        y: rect.y,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
    };
}
