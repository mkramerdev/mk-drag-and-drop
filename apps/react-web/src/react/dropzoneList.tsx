import {
    centerToCenter,
    DragProvider,
    maxDistanceToRect,
    useDragHandle,
    useDraggable,
    useDroppable,
} from "@mk-drag-and-drop/react";
import { useCallback, useRef, useState, type ReactElement } from "react";

const dropzoneListGroup = "dropzone-list";
const endDropzoneId = "dropzone-list:end";
const dragHandleText = "\u22ee\u22ee";
// Example targeting: package helpers are configured with this demo's distance limit.
const dropzoneListTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });

// Example state: the app owns list data and commits reorders on drop.
const initialItems = [
    { draggableId: "dropzone-item-1", label: "Item 1" },
    { draggableId: "dropzone-item-2", label: "Item 2" },
    { draggableId: "dropzone-item-3", label: "Item 3" },
    { draggableId: "dropzone-item-4", label: "Item 4" },
    { draggableId: "dropzone-item-5", label: "Item 5" },
];

type DropzoneListItem = (typeof initialItems)[number];

type DropzoneLine = {
    dropTargetId: string;
    beforeItemId: string | null;
};

type DropTargetElementRegistrar = (
    dropTargetId: string,
    element: HTMLElement | null,
) => void;

export function DropzoneList(): ReactElement {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const dropTargetElementsRef = useRef(new Map<string, HTMLElement>());
    const activeDropTargetIdRef = useRef<string | null>(null);
    // Example state: item order is user-owned state outside the package runtime.
    const [items, setItems] = useState(initialItems);

    const registerDropTargetElement = useCallback<DropTargetElementRegistrar>(
        (dropTargetId, element) => {
            const elements = dropTargetElementsRef.current;

            if (!element) {
                const previousElement = elements.get(dropTargetId);

                if (previousElement) {
                    delete previousElement.dataset.dropzoneLineActive;
                }

                elements.delete(dropTargetId);
                return;
            }

            elements.set(dropTargetId, element);

            if (activeDropTargetIdRef.current === dropTargetId) {
                element.dataset.dropzoneLineActive = "true";
            } else {
                delete element.dataset.dropzoneLineActive;
            }
        },
        [],
    );

    const setActiveDropTargetId = useCallback(
        (dropTargetId: string | null, isActive: boolean): void => {
            if (!dropTargetId) {
                return;
            }

            const element = dropTargetElementsRef.current.get(dropTargetId);

            if (!element) {
                return;
            }

            if (isActive) {
                element.dataset.dropzoneLineActive = "true";
            } else {
                delete element.dataset.dropzoneLineActive;
            }
        },
        [],
    );

    const updateActiveDropTargetId = useCallback(
        ({
            activeDropTargetId,
            previousDropTargetId,
        }: {
            activeDropTargetId: string | null;
            previousDropTargetId: string | null;
        }): void => {
            if (activeDropTargetId === previousDropTargetId) {
                return;
            }

            setActiveDropTargetId(previousDropTargetId, false);
            setActiveDropTargetId(activeDropTargetId, true);
            activeDropTargetIdRef.current = activeDropTargetId;
        },
        [setActiveDropTargetId],
    );

    const clearActiveDropTargetId = useCallback((): void => {
        setActiveDropTargetId(activeDropTargetIdRef.current, false);
        activeDropTargetIdRef.current = null;
    }, [setActiveDropTargetId]);

    return (
        // Package API: DragProvider owns drag lifecycle and runtime configuration.
        <DragProvider
            targetingAlgorithm= {centerToCenter}
            targetingConstraint={dropzoneListTargetingConstraint}
            dragOverlay={({ dragState }) => (
                <div className="sortableOverlay">
                    <div className="dragListHandle">
                        {dragHandleText}
                    </div>
                    <span>{getItemLabel(items, dragState.draggableId)}</span>
                </div>
            )}
            onDragStart={() => {
                clearActiveDropTargetId();
            }}
            onDragUpdate={({ activeDropTargetId, previousDropTargetId }) => {
                updateActiveDropTargetId({
                    activeDropTargetId,
                    previousDropTargetId,
                });
            }}
            onDragEnd={() => {
                clearActiveDropTargetId();
            }}
            onDrop={({ draggableId, dropTargetId }) => {
                // Example drop behavior: translate the package drop target into list order.
                setItems((currentItems) =>
                    moveItemToDropzone(currentItems, draggableId, dropTargetId),
                );
            }}
        >
            <div ref={rootRef} className="dropzoneList">
                {items.map((item) => (
                    <FragmentWithDropzone
                        key={item.draggableId}
                        item={item}
                        registerDropTargetElement={registerDropTargetElement}
                    />
                ))}
                <DropzoneLineTarget
                    line={getEndDropzoneLine()}
                    registerDropTargetElement={registerDropTargetElement}
                />
            </div>
        </DragProvider>
    );
}

// Example rendering: combines app-owned item markup with generated line targets.
function FragmentWithDropzone({
    item,
    registerDropTargetElement,
}: {
    item: DropzoneListItem;
    registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
    return (
        <>
            <DropzoneLineTarget
                line={getDropzoneLineBeforeItem(item.draggableId)}
                registerDropTargetElement={registerDropTargetElement}
            />
            <DropzoneListItem item={item} />
        </>
    );
}

// Example rendering: item markup is app-owned; hooks wire it to the package.
function DropzoneListItem({
    item,
}: {
    item: DropzoneListItem;
}): ReactElement {
    // Package API: registers this row and handle as a draggable item.
    const draggable = useDraggable({
        draggableId: item.draggableId,
        group: dropzoneListGroup,
    });
    const dragHandle = useDragHandle();

    return (
        <div {...draggable} className="dropzoneListItem">
            <div {...dragHandle} className="dragListHandle">
                {dragHandleText}
            </div>
            <span>{item.label}</span>
        </div>
    );
}

// Example rendering: line markup is app-owned; the hook registers the drop target.
function DropzoneLineTarget({
    line,
    registerDropTargetElement,
}: {
    line: DropzoneLine;
    registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
    // Package API: registers an insertion line as a drop target.
    const droppable = useDroppable({
        dropTargetId: line.dropTargetId,
        group: dropzoneListGroup,
    });
    const { ref, ...droppableProps } = droppable;
    const lineRef = useCallback(
        (element: HTMLDivElement | null) => {
            ref(element);
            registerDropTargetElement(line.dropTargetId, element);
        },
        [line.dropTargetId, ref, registerDropTargetElement],
    );

    return (
        <div
            {...droppableProps}
            ref={lineRef}
            className="dropzoneListLine"
            data-dropzone-line-target-id={line.dropTargetId}
        >
            <div className="dropzoneListLineIndicator" />
        </div>
    );
}

// Example drop behavior: map a dropzone line id to user-owned item order.
function moveItemToDropzone(
    items: readonly DropzoneListItem[],
    draggableId: string,
    dropTargetId: string,
): DropzoneListItem[] {
    const dropzoneLine = getDropzoneLines(items).find(
        (line) => line.dropTargetId === dropTargetId,
    );

    if (!dropzoneLine) {
        return [...items];
    }

    const draggedItem = items.find((item) => item.draggableId === draggableId);

    if (!draggedItem) {
        return [...items];
    }

    const nextItems = items.filter((item) => item.draggableId !== draggableId);

    if (dropzoneLine.beforeItemId === null) {
        return [...nextItems, draggedItem];
    }

    const insertionIndex = nextItems.findIndex(
        (item) => item.draggableId === dropzoneLine.beforeItemId,
    );

    if (insertionIndex === -1) {
        return [...items];
    }

    nextItems.splice(insertionIndex, 0, draggedItem);

    return nextItems;
}

// Example rendering: generated drop target ids are a demo convention for insertion lines.
function getDropzoneLines(items: readonly DropzoneListItem[]): DropzoneLine[] {
    return [
        ...items.map((item) => getDropzoneLineBeforeItem(item.draggableId)),
        getEndDropzoneLine(),
    ];
}

function getDropzoneLineBeforeItem(draggableId: string): DropzoneLine {
    return {
        dropTargetId: `dropzone-list:before:${draggableId}`,
        beforeItemId: draggableId,
    };
}

function getEndDropzoneLine(): DropzoneLine {
    return {
        dropTargetId: endDropzoneId,
        beforeItemId: null,
    };
}

function getItemLabel(items: readonly DropzoneListItem[], draggableId: string): string {
    return items.find((item) => item.draggableId === draggableId)?.label ?? "";
}
