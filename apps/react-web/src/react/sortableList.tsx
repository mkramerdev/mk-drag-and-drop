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
const sortableTargetingConstraint = maxDistanceToRect({ maxDistance: 96 });
const sortableModifiers = [lockToYAxis()] as const;

export function SortableList(): ReactElement {
  const [overlayItemId, setOverlayItemId] = useState<string | null>(null);
  const [overlayTargetRect, setOverlayTargetRect] = useState<DragRect | null>(
    null,
  );
  const [items, setItems] = useState(defaultItems);

  function clearOverlayState(): void {
    setOverlayItemId(null);
    setOverlayTargetRect(null);
  }

  return (
    <DragProvider
      keepOverlayOnDrop
      modifiers={sortableModifiers}
      targetingAlgorithm={centerToCenter}
      targetingConstraint={sortableTargetingConstraint}
      onDragStart={({ itemId }) => {
        setOverlayItemId(itemId);
        setOverlayTargetRect(null);
      }}
      onDrop={({ itemId }, { getDropTargetRect, getSortablePlacement }) => {
        const placement = getSortablePlacement(itemId);

        setOverlayTargetRect(getDropTargetRect(itemId));

        if (!placement) {
          return;
        }

        setItems((currentItems) =>
          moveItemToSortablePlacement(currentItems, placement),
        );
      }}
      dragOverlay={({ phase, finish }) => (
        <SortableDragOverlay
          itemId={overlayItemId}
          phase={phase}
          targetRect={overlayTargetRect}
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
            isDragging={overlayItemId === itemId}
          />
        ))}
      </div>
    </DragProvider>
  );
}

function SortableDragOverlay({
    itemId,
    phase,
    targetRect,
    finish,
    onFinish,
}: {
    itemId: string | null;
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
            <span>{itemId ? `Item ${itemId}` : ""}</span>
        </div>
    );
}

function SortableItem({
    itemId,
    isDragging,
}: {
    itemId: string;
    isDragging: boolean;
}): ReactElement {
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
