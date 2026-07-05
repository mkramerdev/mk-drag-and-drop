import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactElement,
    type TransitionEvent,
} from "react";

import {
    centerToCenter,
    DragProvider,
    lockToYAxis,
    maxDistanceToRect,
    useDragHandle,
    useSortable,
    type DragOverlayPhase,
    type DragRect,
    type SortableDropPlacement,
} from "@mk-drag-and-drop/react";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const dragHandleText = "\u22ee\u22ee";
// Example targeting: package helpers are configured with this demo's distance limit.
const sortableTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });
const sortableModifiers = [lockToYAxis()] as const;

export function SortableList(): ReactElement {
  // Example state: the app owns item order, active styling, and release geometry.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [releaseTargetRect, setReleaseTargetRect] = useState<DragRect | null>(
    null,
  );
  const [items, setItems] = useState(defaultItems);

  function clearOverlayState(): void {
    setActiveItemId(null);
    setReleaseTargetRect(null);
  }

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      keepOverlayOnDrop
      modifiers={sortableModifiers}
      targetingAlgorithm={centerToCenter}
      targetingConstraint={sortableTargetingConstraint}
      onDragStart={({ draggableId }) => {
        setActiveItemId(draggableId);
        setReleaseTargetRect(null);
      }}
      onDragEnd={({ dropTargetId }, { getDropTargetRect }) => {
        setReleaseTargetRect(
          dropTargetId ? getDropTargetRect(dropTargetId) : null,
        );

        if (!dropTargetId) {
          setActiveItemId(null);
        }
      }}
      onDrop={({ draggableId, sortablePlacement }) => {
        const placement = sortablePlacement;

        if (!placement) {
          return;
        }

        // Example drop behavior: translate package sortable placement into app data.
        setItems((currentItems) =>
          moveItemToSortablePlacement(currentItems, draggableId, placement),
        );
      }}
      dragOverlay={({ dragState, phase, finish }) => (
        <SortableDragOverlay
          draggableId={dragState.draggableId}
          phase={phase}
          targetRect={releaseTargetRect}
          finish={finish}
          onFinish={clearOverlayState}
        />
      )}
    >
      <div className="sortableParent">
        {items.map((draggableId) => (
          <SortableItem
            key={draggableId}
            draggableId={draggableId}
            isDragging={activeItemId === draggableId}
          />
        ))}
      </div>
    </DragProvider>
  );
}

// Example rendering: overlay markup and release animation are app-owned.
function SortableDragOverlay({
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
            x: targetRect.left - overlayRect.left,
            y: targetRect.top - overlayRect.top,
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
                    ? "sortableOverlay sortableOverlayReleasing"
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
            <span>Item {draggableId}</span>
        </div>
    );
}

// Example rendering: item markup is app-owned; hooks wire it to the package.
function SortableItem({
    draggableId,
    isDragging,
}: {
    draggableId: string;
    isDragging: boolean;
}): ReactElement {
    // Package API: registers this rendered row and handle as a sortable item.
    const sortable = useSortable({
        draggableId,
        group: getSortableGroup(draggableId),
    });
    const dragHandle = useDragHandle()

    return (
        <div
            {...sortable}
            className={
                isDragging ? "sortableItem sortableItemDragging" : "sortableItem"
            }
        >
            <div {...dragHandle} className="dragListHandle">
                {dragHandleText}
            </div> 
            <span>Item {draggableId}</span>   
        </div>
    );
}

function getSortableGroup(draggableId: string): string {
    return draggableId === "3" ? isolatedSortableGroup : sortableGroup;
}

// Example drop behavior: convert sortable placement into user-owned item order.
function moveItemToSortablePlacement(
    items: readonly string[],
    draggableId: string,
    placement: SortableDropPlacement,
): string[] {
    const withoutItem = items.filter((item) => item !== draggableId);

    if (placement.previousDraggableId !== null) {
        const previousIndex = withoutItem.indexOf(placement.previousDraggableId);

        if (previousIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, previousIndex + 1),
            draggableId,
            ...withoutItem.slice(previousIndex + 1),
        ];
    }

    if (placement.nextDraggableId !== null) {
        const nextIndex = withoutItem.indexOf(placement.nextDraggableId);

        if (nextIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, nextIndex),
            draggableId,
            ...withoutItem.slice(nextIndex),
        ];
    }

    return [...items];
}
