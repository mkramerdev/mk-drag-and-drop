import type { KeyboardEventHandler, PointerEventHandler } from "react";

export type DragHandlerRuntime = {
    requestDragStart: (input: {
        itemId: string;
        group: string;
        element: HTMLElement;
        pointerId: number;
        pointerPosition: {
            x: number;
            y: number;
        };
    }) => void;
    isKeyboardDragEnabled: () => boolean;
    handleSourceKeyboardKeyDown: (input: {
        itemId: string;
        group: string;
        element: HTMLElement;
        key: string;
    }) => boolean;
};

const dragHandleSelector = "[data-dnd-drag-handle]";

type CreateDragHandlerInput = {
    itemId: string;
    group: string;
    runtime: DragHandlerRuntime;
    getNode: () => HTMLDivElement | null;
};

export function createDragHandler({
    itemId,
    group,
    runtime,
    getNode,
}: CreateDragHandlerInput): PointerEventHandler<HTMLDivElement> {
    return (event) => {
        const node = getNode();

        if (!node) {
            return;
        }

        if (!shouldStartDragFromEvent(node, event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        runtime.requestDragStart({
            itemId,
            group,
            element: node,
            pointerId: event.pointerId,
            pointerPosition: {
                x: event.clientX,
                y: event.clientY,
            },
        });
    };
}

export function createKeyboardDragHandler({
    itemId,
    group,
    runtime,
    getNode,
}: CreateDragHandlerInput): KeyboardEventHandler<HTMLDivElement> {
    return (event) => {
        const node = getNode();

        if (!node || !shouldHandleKeyboardEvent(node, event)) {
            return;
        }

        const handled = runtime.handleSourceKeyboardKeyDown({
            itemId,
            group,
            element: node,
            key: event.key,
        });

        if (!handled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    };
}

function shouldStartDragFromEvent(
    draggableElement: HTMLElement,
    event: Parameters<PointerEventHandler<HTMLDivElement>>[0],
): boolean {
    if (!(event.target instanceof Element)) {
        return false;
    }

    const hasDragHandle =
        draggableElement.querySelector(dragHandleSelector) !== null;

    if (!hasDragHandle) {
        return true;
    }

    const closestDragHandle = event.target.closest(dragHandleSelector);

    return (
        closestDragHandle !== null &&
        draggableElement.contains(closestDragHandle)
    );
}

function shouldHandleKeyboardEvent(
    draggableElement: HTMLElement,
    event: Parameters<KeyboardEventHandler<HTMLDivElement>>[0],
): boolean {
    if (!(event.target instanceof Element)) {
        return false;
    }

    if (event.target === draggableElement) {
        return true;
    }

    const closestDragHandle = event.target.closest(dragHandleSelector);

    return (
        closestDragHandle !== null &&
        draggableElement.contains(closestDragHandle)
    );
}
