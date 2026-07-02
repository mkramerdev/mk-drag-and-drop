import { DragProvider } from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { Menu } from "lucide-react";
import {
    useCallback,
    useState,
    type ReactElement,
    type ReactNode,
} from "react";
import { useDraggable } from "@mk-drag-and-drop/react/use-draggable";
import { useDroppable } from "@mk-drag-and-drop/react/use-droppable";

const basicDragGroup = "basic-drag";
const rootContainerId = "root";

const draggableItem = {
    itemId: "draggable",
    label: "Item",
};

const rootContainer = {
    targetId: rootContainerId,
    label: "Drop Back Here",
};

const droppableContainer = {
    targetId: "droppable",
    label: "Drop Here",
};

type DraggableItemModel = typeof draggableItem;

export function BasicDrag(): ReactElement {
  const [itemContainer, setItemContainer] = useState(rootContainerId);

  return (
    <DragProvider
      dragOverlay={({ itemId }) => (
        <div className="sortableOverlay">
            <div className="dragListHandle">
                <Menu />
            </div> 
            <span>{itemId === draggableItem.itemId ? draggableItem.label : ""}</span>
        </div>
      )}
      onDrop={({ itemId, dropTarget }) => {
        if (
            itemId !== draggableItem.itemId ||
            !isKnownDropTarget(dropTarget)
        ) {
            return;
        }

        setItemContainer(dropTarget);
      }}
    >
        <div className="draggableItemContainer">
            <DroppableContainer targetId={rootContainer.targetId}>
                <span>{rootContainer.label}</span>
                {itemContainer === rootContainer.targetId ? (
                    <DraggableItem item={draggableItem} />
                ) : null}
            </DroppableContainer>
            <DroppableContainer
                targetId={droppableContainer.targetId}
            >
                <span>{droppableContainer.label}</span>
                {itemContainer === droppableContainer.targetId ? (
                    <DraggableItem item={draggableItem} />
                ) : null}
            </DroppableContainer>
        </div>
    </DragProvider>
  );
}

function DraggableItem({
    item,
}: {
    item: DraggableItemModel;
}): ReactElement {
    const { ref: draggableRef, ...draggable } = useDraggable({
        itemId: item.itemId,
        group: basicDragGroup,
    });
    const dragHandle = useDragHandle();
    const setRef = useCallback(
        (node: HTMLDivElement | null) => {
            draggableRef(node);
        },
        [draggableRef],
    );

    return (
        <div {...draggable} ref={setRef} className="sortableItem">
            <div {...dragHandle} className="dragListHandle">
                <Menu />
            </div> 
            <span>{item.label}</span>
        </div>
    );
}

function isKnownDropTarget(targetId: string): boolean {
    return (
        targetId === rootContainer.targetId ||
        targetId === droppableContainer.targetId
    );
}

function DroppableContainer({
    targetId,
    children,
}: {
    targetId: string;
    children: ReactNode;
}): ReactElement {
    const { ref: droppableRef, ...droppable } = useDroppable({
        targetId,
        group: basicDragGroup,
    });
    const setRef = useCallback(
        (node: HTMLDivElement | null) => {
            droppableRef(node);
        },
        [droppableRef],
    );

    return (
        <div {...droppable} ref={setRef} className="droppableContainer">
            {children}
        </div>
    );
}
