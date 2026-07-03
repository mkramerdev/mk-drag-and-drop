import { DragContext } from "./drag-provider";
import {
    useCallback,
    useContext,
    useRef,
    type HTMLAttributes,
    type RefCallback,
} from "react";

type UseDroppableItem = {
    targetId: string;
    group?: string;
};

type UseDroppableReturn =
    HTMLAttributes<HTMLDivElement> & {
        ref: RefCallback<HTMLDivElement>;
    };

const defaultDroppableGroup = "default";

type DroppableDragRuntime = {
    registerDropTarget: (
        targetId: string,
        element: HTMLElement,
        group: string,
    ) => void;
    unregisterDropTarget: (targetId: string) => void;
};

export function useDroppable({
    targetId,
    group = defaultDroppableGroup,
}: UseDroppableItem): UseDroppableReturn {
    const runtime = useContext(DragContext) as DroppableDragRuntime | null;
    const nodeRef = useRef<HTMLDivElement | null>(null);
    const registeredTargetIdRef = useRef<string | null>(null);

    if (!runtime) {
        throw new Error("useDroppable must be used inside DragProvider");
    }

    const setNodeRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (registeredTargetIdRef.current !== null) {
                runtime.unregisterDropTarget(registeredTargetIdRef.current);
            }

            nodeRef.current = node;

            if (!node) {
                registeredTargetIdRef.current = null;
                return;
            }

            runtime.registerDropTarget(
                targetId,
                node,
                group,
            );
            registeredTargetIdRef.current = targetId;
        },
        [group, runtime, targetId],
    );

    return {
        ref: setNodeRef,
    };
}
