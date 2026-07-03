import { DragContext } from "./drag-provider";
import {
    createDragHandler,
    type DragHandlerRuntime,
} from "./createDragHandler.js";
import {
    useCallback,
    useContext,
    useRef,
    type HTMLAttributes,
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

const defaultDraggableGroup = "default";

export function useDraggable({
    itemId,
    group = defaultDraggableGroup,
}: UseDraggableItem): UseDraggableReturn {
    const runtime = useContext(DragContext) as DragHandlerRuntime | null;
    const nodeRef = useRef<HTMLDivElement | null>(null);

    if (!runtime) {
        throw new Error("useDraggable must be used inside DragProvider");
    }

    const setNodeRef = useCallback((node: HTMLDivElement | null) => {
        nodeRef.current = node;
    }, []);

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
