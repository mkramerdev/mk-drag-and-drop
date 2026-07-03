import {
    DragProvider,
    type DragOverlayPhase,
} from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { Menu } from "lucide-react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type AnimationEvent,
    type ReactElement,
    type ReactNode,
    type TransitionEvent,
} from "react";
import { useDraggable } from "@mk-drag-and-drop/react/use-draggable";
import { useDroppable } from "@mk-drag-and-drop/react/use-droppable";
import {
    maxDistanceToRect,
    pointerToRectDistance,
    type DragRect,
} from "@mk-drag-and-drop/dom";

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
const basicTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });

type DraggableItemModel = typeof draggableItem;

type MovePreview = {
    fromTargetId: string;
    toTargetId: string;
};

export function BasicDrag(): ReactElement {
  const [itemContainer, setItemContainer] = useState(rootContainer.targetId);
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const [overlayTargetRect, setOverlayTargetRect] = useState<DragRect | null>(
    null,
  );

  function finishMovePreview(): void {
    if (!movePreview) {
        return;
    }

    setItemContainer(movePreview.toTargetId);
    setMovePreview(null);
  }

  function clearOverlayState(): void {
    setOverlayTargetRect(null);
  }

  return (
    <DragProvider
      targetingAlgorithm={pointerToRectDistance}
      targetingConstraint={basicTargetingConstraint}
      keepOverlayOnDrop
      dragOverlay={({ phase, finish }) => (
        <BasicDragOverlay
            phase={phase}
            targetRect={overlayTargetRect}
            finish={finish}
            onFinish={clearOverlayState}
        />
      )}
      onDragStart={() => {
        setOverlayTargetRect(null);
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
      onDrop={({ itemId, dropTarget }, { getDropTargetRect }) => {
        if (
            itemId !== draggableItem.itemId ||
            !isKnownDropTarget(dropTarget)
        ) {
            return;
        }

        if (dropTarget === itemContainer || movePreview !== null) {
            return;
        }

        setOverlayTargetRect(getDropTargetRect(dropTarget));
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

function BasicDragOverlay({
    phase,
    targetRect,
    finish,
    onFinish,
}: {
    phase: DragOverlayPhase;
    targetRect: DragRect | null;
    finish: () => void;
    onFinish: () => void;
}): ReactElement {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const completedRef = useRef(false);
    const [releaseOffset, setReleaseOffset] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const completeOverlay = useCallback(() => {
        if (completedRef.current) {
            return;
        }

        completedRef.current = true;
        onFinish();
        finish();
    }, [finish, onFinish]);

    useEffect(() => {
        if (phase === "dragging") {
            completedRef.current = false;
            setReleaseOffset(null);
        }
    }, [phase]);

    useLayoutEffect(() => {
        if (phase !== "released") {
            return;
        }

        const overlay = overlayRef.current;

        if (!overlay || !targetRect) {
            completeOverlay();
            return;
        }

        const overlayRect = overlay.getBoundingClientRect();
        const offset = {
            x: getRectCenterX(targetRect) - getRectCenterX(overlayRect),
            y: getRectCenterY(targetRect) - getRectCenterY(overlayRect),
        };

        if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) {
            completeOverlay();
            return;
        }

        setReleaseOffset(offset);
    }, [completeOverlay, phase, targetRect]);

    function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>): void {
        if (
            phase !== "released" ||
            event.target !== event.currentTarget ||
            event.propertyName !== "transform"
        ) {
            return;
        }

        completeOverlay();
    }

    return (
        <div
            ref={overlayRef}
            className={
                phase === "released"
                    ? "sortableOverlay basicDragOverlayReleasing"
                    : "sortableOverlay"
            }
            style={
                releaseOffset
                    ? {
                        transform: `translate3d(${releaseOffset.x}px, ${releaseOffset.y}px, 0)`,
                      }
                    : undefined
            }
            onTransitionEnd={handleTransitionEnd}
        >
            <div className="dragListHandle">
                <Menu />
            </div>
            <span>{draggableItem.label}</span>
        </div>
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

function getRectCenterX(rect: Pick<DOMRect, "left" | "width">): number {
    return rect.left + rect.width / 2;
}

function getRectCenterY(rect: Pick<DOMRect, "top" | "height">): number {
    return rect.top + rect.height / 2;
}
