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
    maxOverlayCenterDistanceToRect,
    useDragHandle,
    useSortable,
    type DragOverlayPhase,
    type DragRect,
} from "@mk-drag-and-drop/react";

import { moveItemToSortablePlacement } from "./sortablePlacement";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const dragHandleText = "\u22ee\u22ee";
// Example targeting: package helpers are configured with this demo's distance limit.
const sortableTargetingConstraint = maxOverlayCenterDistanceToRect({
    maxDistance: 96,
});
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
      overlayRelease="manual"
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
      dragOverlay={(input) => (
        <SortableDragOverlay
          draggableId={input.dragState.draggableId}
          phase={input.phase}
          targetRect={releaseTargetRect}
          removeOverlay={
            input.phase === "released" ? input.removeOverlay : null
          }
          onReleaseComplete={clearOverlayState}
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
    removeOverlay,
    onReleaseComplete,
}: {
    draggableId: string;
    phase: DragOverlayPhase;
    targetRect: DragRect | null;
    removeOverlay: (() => void) | null;
    onReleaseComplete: () => void;
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
        onReleaseComplete();
        removeOverlay?.();
    }, [onReleaseComplete, removeOverlay]);

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
