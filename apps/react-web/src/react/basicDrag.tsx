import { DragProvider } from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { Menu } from "lucide-react";
import {
    useState,
    type AnimationEvent,
    type ReactElement,
    type ReactNode,
} from "react";
import { useDraggable } from "@mk-drag-and-drop/react/use-draggable";
import { useDroppable } from "@mk-drag-and-drop/react/use-droppable";

const draggableItem = {
    itemId: "draggable",
    label: "Item",
};

const rootContainer = {
    targetId: "droppable-root",
    label: "Drop Back Here",
};

const droppableContainer = {
    targetId: "droppable",
    label: "Drop Here",
};

type DraggableItemModel = typeof draggableItem;

type MovePreview = {
    fromTargetId: string;
    toTargetId: string;
};

export function BasicDrag(): ReactElement {
  const [itemContainer, setItemContainer] = useState(rootContainer.targetId);
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);

  function finishMovePreview(): void {
    if (!movePreview) {
        return;
    }

    setItemContainer(movePreview.toTargetId);
    setMovePreview(null);
  }

  return (
    <DragProvider
      dragOverlay={() => (
        <div className="sortableOverlay">
            <div className="dragListHandle">
                <Menu />
            </div> 
            <span>{draggableItem.label}</span>
        </div>
      )}
      onDragStart={() => {
        clearActiveDroppableContainers();
      }}
      onDragUpdate={({ activeDropTarget, previousDropTarget }) => {
        updateActiveDroppableContainer({
            activeDropTarget,
            previousDropTarget,
        });
      }}
      onDragEnd={() => {
        clearActiveDroppableContainers();
      }}
      onDrop={({ itemId, dropTarget }) => {
        if (
            itemId !== draggableItem.itemId ||
            !isKnownDropTarget(dropTarget)
        ) {
            return;
        }

        if (dropTarget === itemContainer || movePreview !== null) {
            return;
        }

        setMovePreview({
            fromTargetId: itemContainer,
            toTargetId: dropTarget,
        });
      }}
    >
        <div className="draggableItemContainer">
            <DroppableContainer targetId={rootContainer.targetId}>
                <span>{rootContainer.label}</span>
                {itemContainer === rootContainer.targetId ? (
                    <DraggableItem
                        item={draggableItem}
                        isFadingOut={
                            movePreview?.fromTargetId === rootContainer.targetId
                        }
                    />
                ) : null}
                {movePreview?.toTargetId === rootContainer.targetId ? (
                    <DraggableItemPreview
                        item={draggableItem}
                        onFadeInEnd={finishMovePreview}
                    />
                ) : null}
            </DroppableContainer>
            <DroppableContainer
                targetId={droppableContainer.targetId}
            >
                <span>{droppableContainer.label}</span>
                {itemContainer === droppableContainer.targetId ? (
                    <DraggableItem
                        item={draggableItem}
                        isFadingOut={
                            movePreview?.fromTargetId === droppableContainer.targetId
                        }
                    />
                ) : null}
                {movePreview?.toTargetId === droppableContainer.targetId ? (
                    <DraggableItemPreview
                        item={draggableItem}
                        onFadeInEnd={finishMovePreview}
                    />
                ) : null}
            </DroppableContainer>
        </div>
    </DragProvider>
  );
}

function DraggableItem({
    item,
    isFadingOut,
}: {
    item: DraggableItemModel;
    isFadingOut: boolean;
}): ReactElement {
    const draggable = useDraggable({
        itemId: item.itemId,
        group: "basic",
    });
    const dragHandle = useDragHandle();
    
    return (
        <div
            {...draggable}
            className={
                isFadingOut
                    ? "sortableItem sortableItemFadingOut"
                    : "sortableItem"
            }
        >
            <div {...dragHandle} className="dragListHandle">
                <Menu />
            </div> 
            <span>{item.label}</span>
        </div>
    );
}

function DraggableItemPreview({
    item,
    onFadeInEnd,
}: {
    item: DraggableItemModel;
    onFadeInEnd: () => void;
}): ReactElement {
    function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>): void {
        if (
            event.target !== event.currentTarget ||
            event.animationName !== "basicDragItemFadeIn"
        ) {
            return;
        }

        onFadeInEnd();
    }

    return (
        <div
            className="sortableItem sortableItemPreview sortableItemFadingIn"
            onAnimationEnd={handleAnimationEnd}
        >
            <div className="dragListHandle">
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
    const droppable = useDroppable({
        targetId,
        group: "basic",
    });
    

    return (
        <div
            {...droppable}
            className="droppableContainer"
            data-basic-drop-target-id={targetId}
        >
            {children}
        </div>
    );
}

function updateActiveDroppableContainer({
    activeDropTarget,
    previousDropTarget,
}: {
    activeDropTarget: string | null;
    previousDropTarget: string | null;
}): void {
    if (activeDropTarget === previousDropTarget) {
        return;
    }

    setDroppableContainerActive(previousDropTarget, false);
    setDroppableContainerActive(activeDropTarget, true);
}

function clearActiveDroppableContainers(): void {
    getDroppableContainerElements().forEach((element) => {
        delete element.dataset.dndActiveDropTarget;
    });
}

function setDroppableContainerActive(
    dropTarget: string | null,
    isActive: boolean,
): void {
    if (!dropTarget) {
        return;
    }

    getDroppableContainerElements().forEach((element) => {
        if (element.dataset.basicDropTargetId !== dropTarget) {
            return;
        }

        if (isActive) {
            element.dataset.dndActiveDropTarget = "true";
        } else {
            delete element.dataset.dndActiveDropTarget;
        }
    });
}

function getDroppableContainerElements(): NodeListOf<HTMLElement> {
    return document.querySelectorAll("[data-basic-drop-target-id]");
}
