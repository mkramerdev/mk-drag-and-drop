import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { centerToCenter } from "@mk-drag-and-drop/core";
import {
  DragDropProvider,
  useDragHandle,
  useDraggable,
  useDropTarget,
} from "@mk-drag-and-drop/react";
import {
  createDragListItems,
  findDragListItem,
  getOrderedDragListItems,
  type DragListItem,
} from "../shared/list-data";
import {
  createOverlay,
  type DragListOverlay,
} from "../shared/list-overlay";
import {
  applyDragListDrop,
  createDragListDropTargetRegistry,
  type DragListDropTargetRegistry,
} from "./list-drop";

export function DropzoneLineExample(): JSX.Element {
  const [items, setItems] = useState(createDragListItems);
  const overlayRef = useRef<DragListOverlay | null>(null);
  const itemElementsRef = useRef(new Map<string, HTMLElement>());
  const orderedItems = useMemo(() => getOrderedDragListItems(items), [items]);
  const dropTargets = useMemo(
    () => createDropTargetRegistry(orderedItems),
    [orderedItems],
  );
  const registerItemElement = useCallback(
    (itemId: string, element: HTMLElement | null) => {
      if (element) {
        itemElementsRef.current.set(itemId, element);
        return;
      }

      itemElementsRef.current.delete(itemId);
    },
    [],
  );
  const setItemGhosted = useCallback(
    (itemId: string, isGhosted: boolean) => {
      itemElementsRef.current
        .get(itemId)
        ?.classList.toggle("dragListItemGhosted", isGhosted);
    },
    [],
  );

  return (
    <DragDropProvider
      targetingAlgorithm={centerToCenter}
      onDragStart={(
        event,
        { measureDraggable, pointerPosition, recalculateTargets },
      ) => {
        const item = findDragListItem(items, event.draggedKey);
        const sourceRect = measureDraggable(event.draggedKey);

        if (item && sourceRect) {
          setItemGhosted(event.draggedKey, true);

          const overlay = createOverlay({
            draggedKey: event.draggedKey,
            pointerPosition,
            sourceRect,
            item,
            placement: "left-top",
          });

          if (overlay) {
            overlayRef.current = overlay;
            recalculateTargets(overlay.overlayRect);
          }
        }
      }}
      onDragUpdate={(event, { recalculateTargets }) => {
        const overlay = overlayRef.current;

        if (!overlay) {
          return;
        }

        recalculateTargets(overlay.move(event.pointerPosition));
      }}
      onDragEnd={({ draggedKey }) => {
        overlayRef.current?.remove();
        overlayRef.current = null;
        setItemGhosted(draggedKey, false);
      }}
      onDrop={({ draggedKey, dropTargetKey }) => {
        overlayRef.current?.remove();
        overlayRef.current = null;

        const nextItems = items.map((item) => ({ ...item }));
        const changedItemId = applyDragListDrop({
          items: nextItems,
          dropTargets,
          draggedItemId: draggedKey,
          dropTargetKey,
        });

        if (!changedItemId) {
          return;
        }

        setItems(getOrderedDragListItems(nextItems));
      }}
    >
      <div className="drag-parent">
        {orderedItems.map((item, index) => (
          <Fragment key={item.id}>
            <DropTarget dropTargetKey={getDragListDropTargetKey(index)} />
            <DragListItemView
              item={item}
              registerItemElement={registerItemElement}
            />
          </Fragment>
        ))}
        <DropTarget
          dropTargetKey={getDragListDropTargetKey(orderedItems.length)}
        />
      </div>
    </DragDropProvider>
  );
}

function createDropTargetRegistry(
  orderedItems: readonly DragListItem[],
): DragListDropTargetRegistry {
  const dropTargets = createDragListDropTargetRegistry();

  for (const [index, item] of orderedItems.entries()) {
    dropTargets.setDropTarget({
      dropTargetKey: getDragListDropTargetKey(index),
      beforeItemId: item.id,
    });
  }

  dropTargets.setDropTarget({
    dropTargetKey: getDragListDropTargetKey(orderedItems.length),
    beforeItemId: null,
  });

  return dropTargets;
}

function DropTarget(input: { dropTargetKey: string }): JSX.Element {
  const dropTarget = useDropTarget<HTMLDivElement>({
    dropTargetKey: input.dropTargetKey,
  });

  return (
    <div
      ref={dropTarget.ref}
      id={input.dropTargetKey}
      className="dragListDropTarget"
    >
      <div className="dragListDropIndicator" aria-hidden="true" />
    </div>
  );
}

function DragListItemView(input: {
  item: DragListItem;
  registerItemElement: (itemId: string, element: HTMLElement | null) => void;
}): JSX.Element {
  const draggableRef = useDraggable<HTMLDivElement>({
    draggedKey: input.item.id,
  });
  const dragHandleRef = useDragHandle<HTMLDivElement>({
    draggedKey: input.item.id,
  });
  const itemRef = useCallback(
    (element: HTMLDivElement | null) => {
      draggableRef(element);
      input.registerItemElement(input.item.id, element);
    },
    [draggableRef, input.item.id, input.registerItemElement],
  );

  return (
    <div
      ref={itemRef}
      className="dragListItem"
    >
      <div
        ref={dragHandleRef}
        className="dragListHandle"
      />
      <div className="dragListItemText">{input.item.content}</div>
    </div>
  );
}

function getDragListDropTargetKey(index: number): string {
  return `react-demo-drag-list-drop-target-${index}`;
}
