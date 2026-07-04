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
    DragProvider,
    lockToYAxis,
    type DragOverlayPhase,
} from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import { Menu } from "lucide-react";
import {
    centerToCenter,
    maxDistanceToRect,
    type DragRect,
    type SortablePlacement,
} from "@mk-drag-and-drop/dom";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
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
      onDragStart={({ itemId }) => {
        setActiveItemId(itemId);
        setReleaseTargetRect(null);
      }}
      onDragEnd={({ dropTarget }, { getDropTargetRect }) => {
        setReleaseTargetRect(
          dropTarget ? getDropTargetRect(dropTarget) : null,
        );

        if (!dropTarget) {
          setActiveItemId(null);
        }
      }}
      onDrop={({ itemId }, { getSortablePlacement }) => {
        const placement = getSortablePlacement(itemId);

        if (!placement) {
          return;
        }

        // Example drop behavior: translate package sortable placement into app data.
        setItems((currentItems) =>
          moveItemToSortablePlacement(currentItems, placement),
        );
      }}
      dragOverlay={({ dragState, phase, finish }) => (
        <SortableDragOverlay
          itemId={dragState.itemId}
          phase={phase}
          targetRect={releaseTargetRect}
          finish={finish}
          onFinish={clearOverlayState}
        />
      )}
    >
      <div className="sortableParent">
        {items.map((itemId) => (
          <SortableItem
            key={itemId}
            itemId={itemId}
            isDragging={activeItemId === itemId}
          />
        ))}
      </div>
    </DragProvider>
  );
}

// Example rendering: overlay markup and release animation are app-owned.
function SortableDragOverlay({
    itemId,
    phase,
    targetRect,
    finish,
    onFinish,
}: {
    itemId: string;
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
                <Menu />
            </div>
            <span>Item {itemId}</span>
        </div>
    );
}

// Example rendering: item markup is app-owned; hooks wire it to the package.
function SortableItem({
    itemId,
    isDragging,
}: {
    itemId: string;
    isDragging: boolean;
}): ReactElement {
    // Package API: registers this rendered row and handle as a sortable item.
    const sortable = useSortable({
        itemId,
        group: getSortableGroup(itemId),
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
                <Menu />
            </div> 
            <span>Item {itemId}</span>   
        </div>
    );
}

function getSortableGroup(itemId: string): string {
    return itemId === "3" ? isolatedSortableGroup : sortableGroup;
}

// Example drop behavior: convert sortable placement into user-owned item order.
function moveItemToSortablePlacement(
    items: readonly string[],
    placement: SortablePlacement,
): string[] {
    const withoutItem = items.filter((item) => item !== placement.itemId);

    if (placement.previousItemId !== null) {
        const previousIndex = withoutItem.indexOf(placement.previousItemId);

        if (previousIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, previousIndex + 1),
            placement.itemId,
            ...withoutItem.slice(previousIndex + 1),
        ];
    }

    if (placement.nextItemId !== null) {
        const nextIndex = withoutItem.indexOf(placement.nextItemId);

        if (nextIndex === -1) {
            return [...items];
        }

        return [
            ...withoutItem.slice(0, nextIndex),
            placement.itemId,
            ...withoutItem.slice(nextIndex),
        ];
    }

    return [...items];
}
