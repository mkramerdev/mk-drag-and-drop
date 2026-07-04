import {
    DragProvider,
    maxDistanceToRect,
    pointerToRectDistance,
    useDragHandle,
    useDraggable,
    useDroppable,
    type DragOverlayPhase,
    type DragRect,
} from "@mk-drag-and-drop/react";
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

const dragHandleText = "\u22ee\u22ee";

const draggableItem = {
    draggableId: "draggable",
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
// Example targeting: package helpers are configured with this demo's distance limit.
const basicTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });

type DraggableItemModel = typeof draggableItem;

type MovePreview = {
    fromTargetId: string;
    toTargetId: string;
};

export function BasicDrag(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Example state: the app owns item location, preview state, and release animation geometry.
  const [itemContainer, setItemContainer] = useState(rootContainer.targetId);
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const [releaseTargetRect, setReleaseTargetRect] = useState<DragRect | null>(
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
    setReleaseTargetRect(null);
  }

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      targetingAlgorithm={pointerToRectDistance}
      targetingConstraint={basicTargetingConstraint}
      keepOverlayOnDrop
      dragOverlay={({ dragState, phase, finish }) => (
        <BasicDragOverlay
            draggableId={dragState.draggableId}
            phase={phase}
            targetRect={releaseTargetRect}
            finish={finish}
            onFinish={clearOverlayState}
        />
      )}
      onDragStart={() => {
        setReleaseTargetRect(null);
        clearActiveDroppableContainers(rootRef.current);
      }}
      onDragUpdate={({ activeDropTarget, previousDropTarget }) => {
        updateActiveDroppableContainer({
            root: rootRef.current,
            activeDropTarget,
            previousDropTarget,
        });
      }}
      onDragEnd={({ dropTarget }, { getDropTargetRect }) => {
        setReleaseTargetRect(
            dropTarget ? getDropTargetRect(dropTarget) : null,
        );
        clearActiveDroppableContainers(rootRef.current);
      }}
      onDrop={({ draggableId, dropTarget }) => {
        // Example drop behavior: commit the package drop result into app state.
        if (
            draggableId !== draggableItem.draggableId ||
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
        <div ref={rootRef} className="draggableItemContainer">
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

// Example rendering: overlay markup and release animation are app-owned.
function BasicDragOverlay({
    draggableId,
    phase,
    targetRect,
    finish,
    onFinish,
}: {
    draggableId: string;
    phase: DragOverlayPhase;
    targetRect: DragRect | null;
    finish: () => void;
    onFinish: () => void;
}): ReactElement {
    // Example state: release offset exists only to animate this demo's overlay.
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
                {dragHandleText}
            </div>
            <span>{getDraggableItemLabel(draggableId)}</span>
        </div>
    );
}

// Example rendering: this item UI is replaceable; hooks wire it to the package.
function DraggableItem({
    item,
    isFadingOut,
}: {
    item: DraggableItemModel;
    isFadingOut: boolean;
}): ReactElement {
    // Package API: registers this rendered element and handle as draggable.
    const draggable = useDraggable({
        draggableId: item.draggableId,
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
                {dragHandleText}
            </div> 
            <span>{item.label}</span>
        </div>
    );
}

// Example rendering: transient move preview is owned by the demo, not the package.
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
                {dragHandleText}
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
    // Package API: registers this rendered container as a drop target.
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

// Example styling: active target attributes drive demo CSS highlights.
function updateActiveDroppableContainer({
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

    setDroppableContainerActive(root, previousDropTarget, false);
    setDroppableContainerActive(root, activeDropTarget, true);
}

function clearActiveDroppableContainers(root: ParentNode | null): void {
    getDroppableContainerElements(root).forEach((element) => {
        delete element.dataset.basicActiveDropTarget;
    });
}

function setDroppableContainerActive(
    root: ParentNode | null,
    dropTarget: string | null,
    isActive: boolean,
): void {
    if (!dropTarget) {
        return;
    }

    getDroppableContainerElements(root).forEach((element) => {
        if (element.dataset.basicDropTargetId !== dropTarget) {
            return;
        }

        if (isActive) {
            element.dataset.basicActiveDropTarget = "true";
        } else {
            delete element.dataset.basicActiveDropTarget;
        }
    });
}

function getDroppableContainerElements(
    root: ParentNode | null,
): NodeListOf<HTMLElement> {
    return (root ?? document).querySelectorAll("[data-basic-drop-target-id]");
}

function getRectCenterX(rect: Pick<DOMRect, "left" | "width">): number {
    return rect.left + rect.width / 2;
}

function getRectCenterY(rect: Pick<DOMRect, "top" | "height">): number {
    return rect.top + rect.height / 2;
}

function getDraggableItemLabel(draggableId: string): string {
    return draggableId === draggableItem.draggableId ? draggableItem.label : "";
}
