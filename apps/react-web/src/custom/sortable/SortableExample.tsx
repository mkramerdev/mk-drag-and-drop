import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";

import { centerToCenter } from "@mk-drag-and-drop/core";
import {
  DragDropProvider,
  useDragHandle,
  useSortable,
} from "@mk-drag-and-drop/react";
import {
  applySortableDrop,
} from "@mk-drag-and-drop/sortable";
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

export function SortableExample(): ReactElement {
  const [items, setItems] = useState(createDragListItems);
  const overlayRef = useRef<DragListOverlay | null>(null);
  const itemElementsRef = useRef(new Map<string, HTMLElement>());
  const renderedItems = useMemo(
    () => getOrderedDragListItems(items),
    [items],
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
  const getItemElement = useCallback(
    (itemId: string) => itemElementsRef.current.get(itemId) ?? null,
    [],
  );
  const setItemGhosted = useCallback(
    (itemId: string, isGhosted: boolean) => {
      getItemElement(itemId)?.classList.toggle(
        "dragListItemGhosted",
        isGhosted,
      );
    },
    [getItemElement],
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

        if (!item || !sourceRect) {
          return;
        }

        setItemGhosted(event.draggedKey, true);

        const overlay = createOverlay({
          draggedKey: event.draggedKey,
          pointerPosition,
          sourceRect,
          item,
          placement: "left-top",
        });

        if (!overlay) {
          return;
        }

        overlayRef.current = overlay;
        recalculateTargets(overlay.overlayRect);
      }}
      onDragUpdate={(event, { recalculateTargets }) => {
        const overlay = overlayRef.current;

        if (!overlay) {
          return;
        }

        const overlayRect = overlay.move(event.pointerPosition);
        recalculateTargets(overlayRect);
      }}
      onDragEnd={({ draggedKey }) => {
        overlayRef.current?.remove();
        overlayRef.current = null;
        setItemGhosted(draggedKey, false);
      }}
      onDrop={({ draggedKey }) => {
        overlayRef.current?.remove();
        overlayRef.current = null;
        setItems((currentItems) => {
          const nextItems = currentItems.map((item) => ({ ...item }));

          applySortableDrop({
            draggedKey,
            items: nextItems,
            getItemKey: (item) => item.id,
            getItemOrderKey: (item) => item.orderKey,
            setItemOrderKey: (item, orderKey) => {
              item.orderKey = orderKey;
            },
            getItemElement,
          });

          return getOrderedDragListItems(nextItems);
        });
      }}
    >
      <div className="drag-parent sortableList">
        {renderedItems.map((item) => (
          <SortableItemView
            key={item.id}
            item={item}
            registerItemElement={registerItemElement}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

function SortableItemView(
  input: {
    item: DragListItem;
    registerItemElement: (itemId: string, element: HTMLElement | null) => void;
  },
): ReactElement {
  const sortable = useSortable<HTMLDivElement>({
    itemKey: input.item.id,
  });
  const dragHandleRef = useDragHandle<HTMLDivElement>({
    draggedKey: input.item.id,
  });
  const sortableRef = useCallback(
    (element: HTMLDivElement | null) => {
      sortable.ref(element);
      input.registerItemElement(input.item.id, element);
    },
    [input, sortable.ref],
  );

  return (
    <div ref={sortableRef} className="dragListItem">
      <div ref={dragHandleRef} className="dragListHandle" />
      <div className="dragListItemText">{input.item.content}</div>
    </div>
  );
}
