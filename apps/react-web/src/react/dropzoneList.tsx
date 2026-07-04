import {
    centerToCenter,
    DragProvider,
    maxDistanceToRect,
    useDragHandle,
    useDraggable,
    useDroppable,
} from "@mk-drag-and-drop/react";
import { Menu } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";

const dropzoneListGroup = "dropzone-list";
const endDropzoneId = "dropzone-list:end";
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
    targetId: string;
    beforeItemId: string | null;
};

export function DropzoneList(): ReactElement {
    const rootRef = useRef<HTMLDivElement | null>(null);
    // Example state: item order is user-owned state outside the package runtime.
    const [items, setItems] = useState(initialItems);

    return (
        // Package API: DragProvider owns drag lifecycle and runtime configuration.
        <DragProvider
            targetingAlgorithm= {centerToCenter}
            targetingConstraint={dropzoneListTargetingConstraint}
            dragOverlay={({ dragState }) => (
                <div className="sortableOverlay">
                    <div className="dragListHandle">
                        <Menu />
                    </div>
                    <span>{getItemLabel(items, dragState.draggableId)}</span>
                </div>
            )}
            onDragStart={() => {
                clearActiveDropzoneLines(rootRef.current);
            }}
            onDragUpdate={({ activeDropTarget, previousDropTarget }) => {
                updateActiveDropzoneLine({
                    root: rootRef.current,
                    activeDropTarget,
                    previousDropTarget,
                });
            }}
            onDragEnd={() => {
                clearActiveDropzoneLines(rootRef.current);
            }}
            onDrop={({ draggableId, dropTarget }) => {
                // Example drop behavior: translate the package drop target into list order.
                setItems((currentItems) =>
                    moveItemToDropzone(currentItems, draggableId, dropTarget),
                );
            }}
        >
            <div ref={rootRef} className="dropzoneList">
                {items.map((item) => (
                    <FragmentWithDropzone key={item.draggableId} item={item} />
                ))}
                <DropzoneLineTarget line={getEndDropzoneLine()} />
            </div>
        </DragProvider>
    );
}

// Example rendering: combines app-owned item markup with generated line targets.
function FragmentWithDropzone({
    item,
}: {
    item: DropzoneListItem;
}): ReactElement {
    return (
        <>
            <DropzoneLineTarget line={getDropzoneLineBeforeItem(item.draggableId)} />
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
                <Menu />
            </div>
            <span>{item.label}</span>
        </div>
    );
}

// Example rendering: line markup is app-owned; the hook registers the drop target.
function DropzoneLineTarget({ line }: { line: DropzoneLine }): ReactElement {
    // Package API: registers an insertion line as a drop target.
    const droppable = useDroppable({
        targetId: line.targetId,
        group: dropzoneListGroup,
    });

    return (
        <div
            {...droppable}
            className="dropzoneListLine"
            data-dropzone-line-target-id={line.targetId}
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
        (line) => line.targetId === dropTargetId,
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

// Example rendering: generated target ids are a demo convention for insertion lines.
function getDropzoneLines(items: readonly DropzoneListItem[]): DropzoneLine[] {
    return [
        ...items.map((item) => getDropzoneLineBeforeItem(item.draggableId)),
        getEndDropzoneLine(),
    ];
}

function getDropzoneLineBeforeItem(draggableId: string): DropzoneLine {
    return {
        targetId: `dropzone-list:before:${draggableId}`,
        beforeItemId: draggableId,
    };
}

function getEndDropzoneLine(): DropzoneLine {
    return {
        targetId: endDropzoneId,
        beforeItemId: null,
    };
}

function getItemLabel(items: readonly DropzoneListItem[], draggableId: string): string {
    return items.find((item) => item.draggableId === draggableId)?.label ?? "";
}

// Example styling: active target attributes drive demo CSS highlights.
function updateActiveDropzoneLine({
    root,
    activeDropTarget,
    previousDropTarget,
}: {
    root: ParentNode | null;
    activeDropTarget: string | null;
    previousDropTarget: string | null;
}): void {
    if (activeDropTarget === previousDropTarget) {
        return;
    }

    setDropzoneLineActive(root, previousDropTarget, false);
    setDropzoneLineActive(root, activeDropTarget, true);
}

function clearActiveDropzoneLines(root: ParentNode | null): void {
    getDropzoneLineElements(root).forEach((element) => {
        delete element.dataset.dropzoneLineActive;
    });
}

function setDropzoneLineActive(
    root: ParentNode | null,
    dropTarget: string | null,
    isActive: boolean,
): void {
    if (!dropTarget) {
        return;
    }

    getDropzoneLineElements(root).forEach((element) => {
        if (element.dataset.dropzoneLineTargetId !== dropTarget) {
            return;
        }

        if (isActive) {
            element.dataset.dropzoneLineActive = "true";
        } else {
            delete element.dataset.dropzoneLineActive;
        }
    });
}

function getDropzoneLineElements(
    root: ParentNode | null,
): NodeListOf<HTMLElement> {
    return (root ?? document).querySelectorAll("[data-dropzone-line-target-id]");
}
