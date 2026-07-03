import type { PointerEventHandler } from "react";
import type { DragRuntime } from "./drag-provider";

const dragHandleSelector = "[data-dnd-drag-handle]";

type CreateDragHandlerInput = {
    itemId: string;
    group: string;
    runtime: DragRuntime;
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
