import {
    DragContext,
    type RemeasureDropTargetsInput,
} from "./drag-provider";
import {
    createDragHandler,
    type DragHandlerRuntime,
} from "./createDragHandler.js";
import {
    useContext,
    useCallback,
    useRef,
    type HTMLAttributes,
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

type SortableDragRuntime = DragHandlerRuntime & {
    registerDropTarget: (
        itemId: string,
        element: HTMLElement,
        group: string,
    ) => void;
    unregisterDropTarget: (itemId: string) => void;
    subscribe: (subscription: {
        onDragStart?: (event: { itemId: string }) => void;
        onDragUpdate?: (event: {
            itemId: string;
            activeDropTarget: string | null;
            previousDropTarget: string | null;
        }) => void;
        onDragEnd?: (event: {
            itemId: string;
            dropTarget: string | null;
        }) => void;
        onDrop?: (event: {
            itemId: string;
            dropTarget: string;
        }) => void;
    }) => () => void;
    remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

const sortableRegistries = new WeakMap<SortableDragRuntime, SortableRegistry>();
const defaultSortableGroup = "default";

export function useSortable({
    itemId,
    group = defaultSortableGroup,
}: UseSortableOptions): UseSortableResult {
    const runtime = useContext(DragContext) as SortableDragRuntime | null;
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
        onPointerDown: createDragHandler({
            itemId,
            group,
            runtime,
            getNode: () => nodeRef.current,
        }),
    };
}

function getSortableRegistry(runtime: SortableDragRuntime): SortableRegistry {
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
                if (restoreSortableSnapshot(registry, event.itemId)) {
                    remeasureSortableDropTargetGroup({
                        registry,
                        runtime,
                        itemId: event.itemId,
                    });
                }
            }

            clearSortableDraggedState(registry, event.itemId);
            registry.snapshots.delete(event.itemId);
        },
        onDrop: (event) => {
            clearSortableDraggedState(registry, event.itemId);
            registry.snapshots.delete(event.itemId);
            remeasureSortableDropTargetGroup({
                registry,
                runtime,
                itemId: event.itemId,
            });
        },
    });

    sortableRegistries.set(runtime, registry);

    return registry;
}

function unregisterSortableElement(input: {
    registry: SortableRegistry;
    runtime: SortableDragRuntime;
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
    runtime: SortableDragRuntime;
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

    remeasureSortableDropTargetGroup({
        registry: input.registry,
        runtime: input.runtime,
        itemId: input.draggedItemId,
    });
}

function restoreSortableSnapshot(
    registry: SortableRegistry,
    itemId: string,
): boolean {
    const snapshot = registry.snapshots.get(itemId);

    if (!snapshot || snapshot.element.parentElement !== snapshot.parent) {
        return false;
    }

    if (snapshot.nextSibling?.parentNode === snapshot.parent) {
        snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
        return true;
    }

    snapshot.parent.append(snapshot.element);
    return true;
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

function remeasureSortableDropTargetGroup(input: {
    registry: SortableRegistry;
    runtime: SortableDragRuntime;
    itemId: string;
}): void {
    const group = input.registry.groups.get(input.itemId);

    if (!group) {
        return;
    }

    input.runtime.remeasureDropTargets({ group });
}

function registerSortableDropTarget(
    runtime: SortableDragRuntime,
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
