import {
    DragContext,
    type RemeasureDropTargetsInput,
} from "./drag-provider";
import {
    createDragHandler,
    createKeyboardDragHandler,
    type DragHandlerRuntime,
} from "./createDragHandler.js";
import {
    useContext,
    useCallback,
    useMemo,
    useRef,
    type HTMLAttributes,
    type RefCallback,
} from "react";
import type { DragRect } from "@mk-drag-and-drop/core";

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

type Point = {
    x: number;
    y: number;
};

type SortablePlacementSide = "before" | "after";

type SortableDragRuntime = DragHandlerRuntime & {
    registerDropTarget: (
        itemId: string,
        element: HTMLElement,
        group: string,
    ) => void;
    unregisterDropTarget: (itemId: string) => void;
    pointerPosition: Point | null;
    getCurrentDragRect: () => DragRect | null;
    getDropTargetRect: (dropTargetId: string) => DragRect | null;
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
    const getNode = useCallback(() => nodeRef.current, []);
    const onPointerDown = useMemo(
        () =>
            createDragHandler({
                itemId,
                group,
                runtime,
                getNode,
            }),
        [getNode, group, itemId, runtime],
    );
    const onKeyDown = useMemo(
        () =>
            createKeyboardDragHandler({
                itemId,
                group,
                runtime,
                getNode,
            }),
        [getNode, group, itemId, runtime],
    );
    const keyboardDragEnabled = runtime.isKeyboardDragEnabled();

    return useMemo(() => {
        const dragProps: UseSortableResult = {
            ref: setNodeRef,
            onPointerDown,
        };

        return keyboardDragEnabled
            ? {
                ...dragProps,
                tabIndex: 0,
                onKeyDown,
            }
            : dragProps;
    }, [keyboardDragEnabled, onKeyDown, onPointerDown, setNodeRef]);
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
                !isSortablePreviewTarget({
                    draggedItemId: event.itemId,
                    activeDropTarget: event.activeDropTarget,
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

function isSortablePreviewTarget(input: {
    draggedItemId: string;
    activeDropTarget: string | null;
}): boolean {
    return (
        input.activeDropTarget !== null &&
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
    const targetRect = input.runtime.getDropTargetRect(input.activeDropTarget);
    const placement = targetRect
        ? getSortablePreviewPlacement({
            runtime: input.runtime,
            draggedItemId: input.draggedItemId,
            targetRect,
        })
        : null;

    if (
        !draggedElement ||
        !targetElement ||
        !listElement ||
        !placement ||
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

    if (
        isSortablePreviewAlreadyPlaced({
            draggedElement,
            targetElement,
            placement,
        })
    ) {
        return;
    }

    if (placement === "after") {
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

function getSortablePreviewPlacement(input: {
    runtime: SortableDragRuntime;
    draggedItemId: string;
    targetRect: DragRect;
}): SortablePlacementSide | null {
    const draggedRect = input.runtime.getCurrentDragRect();
    const remeasuredDraggedRect = input.runtime.getDropTargetRect(
        input.draggedItemId,
    );
    const draggedHeight = remeasuredDraggedRect?.height ?? draggedRect?.height;
    const draggedCenterY = draggedRect
        ? draggedRect.top + (draggedHeight ?? draggedRect.height) / 2
        : input.runtime.pointerPosition?.y;

    if (draggedCenterY === undefined) {
        return null;
    }

    return draggedCenterY < input.targetRect.top + input.targetRect.height / 2
        ? "before"
        : "after";
}

function isSortablePreviewAlreadyPlaced(input: {
    draggedElement: HTMLElement;
    targetElement: HTMLElement;
    placement: SortablePlacementSide;
}): boolean {
    return input.placement === "before"
        ? input.draggedElement.nextElementSibling === input.targetElement
        : input.draggedElement.previousElementSibling === input.targetElement;
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
