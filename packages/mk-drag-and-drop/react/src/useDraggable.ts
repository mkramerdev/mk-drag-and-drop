import { DragContext } from "./drag-provider";
import {
    createDragHandler,
    createKeyboardDragHandler,
    type DragHandlerRuntime,
} from "./createDragHandler.js";
import {
    useCallback,
    useContext,
    useMemo,
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
        const dragProps: UseDraggableReturn = {
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
