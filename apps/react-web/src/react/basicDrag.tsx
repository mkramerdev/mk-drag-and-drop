import {
    DragProvider,
    maxPointerDistanceToRect,
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
    dropTargetId: "droppable-root",
    label: "Drop Back Here",
};

const droppableContainer = {
    dropTargetId: "droppable",
    label: "Drop Here",
};
// Example targeting: package helpers are configured with this demo's distance limit.
const basicTargetingConstraint = maxPointerDistanceToRect({ maxDistance: 96 });

type DraggableItemModel = typeof draggableItem;

type MovePreview = {
    fromTargetId: string;
    toTargetId: string;
};

type DropTargetElementRegistrar = (
    dropTargetId: string,
    element: HTMLElement | null,
) => void;

export function BasicDrag(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropTargetElementsRef = useRef(new Map<string, HTMLElement>());
  const activeDropTargetIdRef = useRef<string | null>(null);
  // Example state: the app owns item location, preview state, and release animation geometry.
  const [itemContainer, setItemContainer] = useState(rootContainer.dropTargetId);
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

  const registerDropTargetElement = useCallback<DropTargetElementRegistrar>(
    (dropTargetId, element) => {
        const elements = dropTargetElementsRef.current;

        if (!element) {
            const previousElement = elements.get(dropTargetId);

            if (previousElement) {
                delete previousElement.dataset.basicActiveDropTarget;
            }

            elements.delete(dropTargetId);
            return;
        }

        elements.set(dropTargetId, element);

        if (activeDropTargetIdRef.current === dropTargetId) {
            element.dataset.basicActiveDropTarget = "true";
        } else {
            delete element.dataset.basicActiveDropTarget;
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
            element.dataset.basicActiveDropTarget = "true";
        } else {
            delete element.dataset.basicActiveDropTarget;
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
        clearActiveDropTargetId();
      }}
      onDragUpdate={({ activeDropTargetId, previousDropTargetId }) => {
        updateActiveDropTargetId({
            activeDropTargetId,
            previousDropTargetId,
        });
      }}
      onDragEnd={({ dropTargetId }, { getDropTargetRect }) => {
        setReleaseTargetRect(
            dropTargetId ? getDropTargetRect(dropTargetId) : null,
        );
        clearActiveDropTargetId();
      }}
      onDrop={({ draggableId, dropTargetId }) => {
        // Example drop behavior: commit the package drop result into app state.
        if (
            draggableId !== draggableItem.draggableId ||
            !isKnownDropTarget(dropTargetId)
        ) {
            return;
        }

        if (dropTargetId === itemContainer || movePreview !== null) {
            return;
        }

        setMovePreview({
            fromTargetId: itemContainer,
            toTargetId: dropTargetId,
        });
      }}
    >
        <div ref={rootRef} className="draggableItemContainer">
            <DroppableContainer
                dropTargetId={rootContainer.dropTargetId}
                registerDropTargetElement={registerDropTargetElement}
            >
                <span>{rootContainer.label}</span>
                {itemContainer === rootContainer.dropTargetId ? (
                    <DraggableItem
                        item={draggableItem}
                        isFadingOut={
                            movePreview?.fromTargetId === rootContainer.dropTargetId
                        }
                    />
                ) : null}
                {movePreview?.toTargetId === rootContainer.dropTargetId ? (
                    <DraggableItemPreview
                        item={draggableItem}
                        onFadeInEnd={finishMovePreview}
                    />
                ) : null}
            </DroppableContainer>
            <DroppableContainer
                dropTargetId={droppableContainer.dropTargetId}
                registerDropTargetElement={registerDropTargetElement}
            >
                <span>{droppableContainer.label}</span>
                {itemContainer === droppableContainer.dropTargetId ? (
                    <DraggableItem
                        item={draggableItem}
                        isFadingOut={
                            movePreview?.fromTargetId === droppableContainer.dropTargetId
                        }
                    />
                ) : null}
                {movePreview?.toTargetId === droppableContainer.dropTargetId ? (
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

function isKnownDropTarget(dropTargetId: string): boolean {
    return (
        dropTargetId === rootContainer.dropTargetId ||
        dropTargetId === droppableContainer.dropTargetId
    );
}

function DroppableContainer({
    dropTargetId,
    children,
    registerDropTargetElement,
}: {
    dropTargetId: string;
    children: ReactNode;
    registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
    // Package API: registers this rendered container as a drop target.
    const droppable = useDroppable({
        dropTargetId,
        group: "basic",
    });
    const { ref, ...droppableProps } = droppable;
    const elementRef = useCallback(
        (element: HTMLDivElement | null) => {
            ref(element);
            registerDropTargetElement(dropTargetId, element);
        },
        [ref, registerDropTargetElement, dropTargetId],
    );
    

    return (
        <div
            {...droppableProps}
            ref={elementRef}
            className="droppableContainer"
            data-basic-drop-target-id={dropTargetId}
        >
            {children}
        </div>
    );
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
