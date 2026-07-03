import type { PointerEventHandler } from "react";

export type DragHandlerRuntime = {
    startDrag: (input: {
        itemId: string;
        group: string;
        pointerPosition: {
            x: number;
            y: number;
        };
        sourceRect: DOMRect;
    }) => void;
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

        runtime.startDrag({
            itemId,
            group,
            pointerPosition: {
                x: event.clientX,
                y: event.clientY,
            },
            sourceRect: node.getBoundingClientRect(),
        });
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
