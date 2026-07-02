import { DragContext, type DragRuntime } from "./drag-provider";
import {
    useCallback,
    useContext,
    useRef,
    type HTMLAttributes,
    type PointerEventHandler,
    type RefCallback,
} from "react";

type UseDraggableItem = {
    itemId: string;
    group?: string;
};

type UseDraggableReturn =
    HTMLAttributes<HTMLDivElement> & {
        ref: RefCallback<HTMLDivElement>;
    };

const dragHandleSelector = "[data-dnd-drag-handle]";
const defaultDraggableGroup = "default";

export function useDraggable({
    itemId,
    group = defaultDraggableGroup,
}: UseDraggableItem): UseDraggableReturn {
    const runtime = useContext(DragContext);
    const nodeRef = useRef<HTMLDivElement | null>(null);

    if (!runtime) {
        throw new Error("useDraggable must be used inside DragProvider");
    }

    const setNodeRef = useCallback((node: HTMLDivElement | null) => {
        nodeRef.current = node;
    }, []);

    return {
        ref: setNodeRef,
        onPointerDown: createDragHandler(
            itemId,
            group,
            runtime,
            () => nodeRef.current,
        ),
    };
}

function createDragHandler(
    itemId: string,
    group: string,
    runtime: DragRuntime,
    getNode: () => HTMLDivElement | null,
): PointerEventHandler<HTMLDivElement> {
    return (event) => {
        const node = getNode();
        if (!node) return;
        if (!shouldStartDragFromEvent(node, event)) return;

        event.preventDefault();

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
