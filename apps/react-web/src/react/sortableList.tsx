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
    type DragOverlayPhase,
    type SortablePlacement,
} from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import { Menu } from "lucide-react";
import { centerToCenter, type DragRect } from "@mk-drag-and-drop/core";

const defaultItems = ["1", "2", "3", "4", "5"];
const storageKey = "mk-drag-and-drop:sortable-items:v2";
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const items = loadItems();

export function SortableList(): ReactElement {
  const [overlayItemId, setOverlayItemId] = useState<string | null>(null);
  const [overlayTargetRect, setOverlayTargetRect] = useState<DragRect | null>(
    null,
  );

  function clearOverlayState(): void {
    setOverlayItemId(null);
    setOverlayTargetRect(null);
  }

  return (
    <DragProvider
      keepOverlayOnDrop
      targetingAlgorithm={centerToCenter}
      onDragStart={({ itemId }) => {
        setOverlayItemId(itemId);
        setOverlayTargetRect(null);
      }}
      onDrop={({ itemId }, { getDropTargetRect, getSortablePlacement }) => {
        const placement = getSortablePlacement(itemId);

        setOverlayTargetRect(getDropTargetRect(itemId));

        if (placement) {
            persistPlacement(placement);
        }
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
          <SortableItem key={itemId} itemId={itemId} />
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

function SortableItem({ itemId }: { itemId: string }): ReactElement {
    const sortable = useSortable({
        itemId,
        group: getSortableGroup(itemId),
    });
    const dragHandle = useDragHandle()

    return (
        <div {...sortable} className="sortableItem">
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

function loadItems(): string[] {
    try {
        const serializedItems = localStorage.getItem(storageKey);

        if (!serializedItems) {
            return [...defaultItems];
        }

        const parsedItems: unknown = JSON.parse(serializedItems);

        if (!Array.isArray(parsedItems)) {
            return [...defaultItems];
        }

        const restoredItems = parsedItems.filter(
            (item): item is string => typeof item === "string",
        );

        return normalizeItems(restoredItems);
    } catch {
        return [...defaultItems];
    }
}

function persistPlacement(placement: SortablePlacement): void {
    const nextItems = items.filter((item) => item !== placement.itemId);

    if (placement.previousItemId !== null) {
        const previousIndex = nextItems.indexOf(placement.previousItemId);

        if (previousIndex === -1) {
            return;
        }

        nextItems.splice(previousIndex + 1, 0, placement.itemId);
    } else if (placement.nextItemId !== null) {
        const nextIndex = nextItems.indexOf(placement.nextItemId);

        if (nextIndex === -1) {
            return;
        }

        nextItems.splice(nextIndex, 0, placement.itemId);
    } else {
        nextItems.push(placement.itemId);
    }

    const normalizedItems = normalizeItems(nextItems);

    if (normalizedItems.length === 0) {
        return;
    }

    items.splice(0, items.length, ...normalizedItems);
    localStorage.setItem(storageKey, JSON.stringify(items));
}

function normalizeItems(nextItems: readonly string[]): string[] {
    const allowedItems = new Set(defaultItems);
    const normalizedItems: string[] = [];

    for (const item of nextItems) {
        if (!allowedItems.has(item) || normalizedItems.includes(item)) {
            continue;
        }

        normalizedItems.push(item);
    }

    for (const item of defaultItems) {
        if (!normalizedItems.includes(item)) {
            normalizedItems.push(item);
        }
    }

    return normalizedItems;
}
