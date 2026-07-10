import { useState, type ReactElement } from "react";

import {
  centerToCenter,
  DragProvider,
  lockToYAxis,
  maxOverlayCenterDistanceToRect,
  useDragHandle,
  useSortable,
} from "@mk-drag-and-drop/react";

import { moveItemToSortablePlacement } from "./sortable-placement";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const dragHandleText = "\u22ee\u22ee";
const sortableTargetingConstraint = maxOverlayCenterDistanceToRect({
  maxDistance: 96,
});
const sortableModifiers = [lockToYAxis()] as const;

export function SortableList(): ReactElement {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [items, setItems] = useState(defaultItems);

  return (
    <DragProvider
      modifiers={sortableModifiers}
      targetingAlgorithm={centerToCenter}
      targetingConstraint={sortableTargetingConstraint}
      onDragStart={({ draggableId }) => {
        setActiveItemId(draggableId);
      }}
      onDragEnd={() => {
        setActiveItemId(null);
      }}
      onDrop={({ draggableId, sortablePlacement }) => {
        if (!sortablePlacement) {
          return;
        }

        setItems((currentItems) =>
          moveItemToSortablePlacement(
            currentItems,
            draggableId,
            sortablePlacement,
          ),
        );
      }}
      dragOverlay={({ dragState }) => (
        <SortableDragOverlay draggableId={dragState.draggableId} />
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

function SortableDragOverlay({
  draggableId,
}: {
  draggableId: string;
}): ReactElement {
  return (
    <div className="sortableOverlay">
      <div className="dragListHandle">{dragHandleText}</div>
      <span>Item {draggableId}</span>
    </div>
  );
}

function SortableItem({
  draggableId,
  isDragging,
}: {
  draggableId: string;
  isDragging: boolean;
}): ReactElement {
  const sortable = useSortable({
    draggableId,
    group: sortableGroup,
  });
  const dragHandle = useDragHandle<HTMLButtonElement>();

  return (
    <div
      {...sortable}
      className={
        isDragging ? "sortableItem sortableItemDragging" : "sortableItem"
      }
    >
      <button {...dragHandle} type="button" className="dragListHandle">
        {dragHandleText}
      </button>
      <span>Item {draggableId}</span>
    </div>
  );
}
