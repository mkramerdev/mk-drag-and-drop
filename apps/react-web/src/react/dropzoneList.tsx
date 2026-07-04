import { DragProvider } from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useDraggable } from "@mk-drag-and-drop/react/use-draggable";
import { useDroppable } from "@mk-drag-and-drop/react/use-droppable";
import { Menu } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";
import { centerToCenter, maxDistanceToRect } from "@mk-drag-and-drop/dom";

const dropzoneListGroup = "dropzone-list";
const endDropzoneId = "dropzone-list:end";
const dropzoneListTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });

const initialItems = [
    { itemId: "dropzone-item-1", label: "Item 1" },
    { itemId: "dropzone-item-2", label: "Item 2" },
    { itemId: "dropzone-item-3", label: "Item 3" },
    { itemId: "dropzone-item-4", label: "Item 4" },
    { itemId: "dropzone-item-5", label: "Item 5" },
];

type DropzoneListItem = (typeof initialItems)[number];

type DropzoneLine = {
    targetId: string;
    beforeItemId: string | null;
};

export function DropzoneList(): ReactElement {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [items, setItems] = useState(initialItems);

    return (
        <DragProvider
            targetingAlgorithm= {centerToCenter}
            targetingConstraint={dropzoneListTargetingConstraint}
            dragOverlay={({ dragState }) => (
                <div className="sortableOverlay">
                    <div className="dragListHandle">
                        <Menu />
                    </div>
                    <span>{getItemLabel(items, dragState.itemId)}</span>
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
            onDrop={({ itemId, dropTarget }) => {
                setItems((currentItems) =>
                    moveItemToDropzone(currentItems, itemId, dropTarget),
                );
            }}
        >
            <div ref={rootRef} className="dropzoneList">
                {items.map((item) => (
                    <FragmentWithDropzone key={item.itemId} item={item} />
                ))}
                <DropzoneLineTarget line={getEndDropzoneLine()} />
            </div>
        </DragProvider>
    );
}

function FragmentWithDropzone({
    item,
}: {
    item: DropzoneListItem;
}): ReactElement {
    return (
        <>
            <DropzoneLineTarget line={getDropzoneLineBeforeItem(item.itemId)} />
            <DropzoneListItem item={item} />
        </>
    );
}

function DropzoneListItem({
    item,
}: {
    item: DropzoneListItem;
}): ReactElement {
    const draggable = useDraggable({
        itemId: item.itemId,
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

function DropzoneLineTarget({ line }: { line: DropzoneLine }): ReactElement {
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

function moveItemToDropzone(
    items: readonly DropzoneListItem[],
    itemId: string,
    dropTargetId: string,
): DropzoneListItem[] {
    const dropzoneLine = getDropzoneLines(items).find(
        (line) => line.targetId === dropTargetId,
    );

    if (!dropzoneLine) {
        return [...items];
    }

    const draggedItem = items.find((item) => item.itemId === itemId);

    if (!draggedItem) {
        return [...items];
    }

    const nextItems = items.filter((item) => item.itemId !== itemId);

    if (dropzoneLine.beforeItemId === null) {
        return [...nextItems, draggedItem];
    }

    const insertionIndex = nextItems.findIndex(
        (item) => item.itemId === dropzoneLine.beforeItemId,
    );

    if (insertionIndex === -1) {
        return [...items];
    }

    nextItems.splice(insertionIndex, 0, draggedItem);

    return nextItems;
}

function getDropzoneLines(items: readonly DropzoneListItem[]): DropzoneLine[] {
    return [
        ...items.map((item) => getDropzoneLineBeforeItem(item.itemId)),
        getEndDropzoneLine(),
    ];
}

function getDropzoneLineBeforeItem(itemId: string): DropzoneLine {
    return {
        targetId: `dropzone-list:before:${itemId}`,
        beforeItemId: itemId,
    };
}

function getEndDropzoneLine(): DropzoneLine {
    return {
        targetId: endDropzoneId,
        beforeItemId: null,
    };
}

function getItemLabel(items: readonly DropzoneListItem[], itemId: string): string {
    return items.find((item) => item.itemId === itemId)?.label ?? "";
}

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
