import {
  dragListItems,
  type DragListItem,
  findDragListItem,
  getOrderedDragListItems,
} from "../shared/list-data";
import { setDragListItemGhosted } from "../shared/list-drag-effects";
import {
  createOverlay,
  renderDragListOverlayContent,
  type DragListOverlay,
} from "../shared/list-overlay";
import {
  centerToCenter,
  createDragRuntime,
} from "@mk-drag-and-drop/core";
import {
  createDomDragHandler,
  createDomDragSession,
  measureDomElement,
  type DomDragSession,
} from "@mk-drag-and-drop/dom";
import {
  applySortableDrop,
  moveSortablePreview,
  restoreSortableDraggedItem,
  shouldMoveSortablePreview,
} from "@mk-drag-and-drop/sortable";
import {
  createSortableItemElement,
} from "./sortable-render";

export function mountSortableExample(parent: HTMLElement): void {
  const runtime = createDragRuntime();
  const session = createDomDragSession();
  let overlay: DragListOverlay | null = null;
  const list = document.createElement("div");
  const itemsInOrder = getOrderedDragListItems();
  const itemElements = new Map<string, HTMLElement>();
  const getItemElement = (itemId: string): HTMLElement | null =>
    itemElements.get(itemId) ?? null;

  list.className = "drag-parent sortableList";

  for (const item of itemsInOrder) {
    const element = createSortableItemElement(item);

    itemElements.set(item.id, element);
    list.append(element);
  }

  parent.replaceChildren(list);
  session.dropTargets = measureSortableDropTargets(
    itemsInOrder,
    getItemElement,
  );

  const dragHandler = createDomDragHandler({
    runtime,
    session,
    targetingAlgorithm: centerToCenter,
    onDragStart: (event, { pointerPosition, recalculateTargets }) => {
      const item = findDragListItem(dragListItems, event.draggedKey);
      const sourceElement = getItemElement(event.draggedKey);

      setDragListItemGhosted({
        itemId: event.draggedKey,
        isGhosted: true,
        getItemElement,
      });

      if (item && sourceElement) {
        overlay = createOverlay({
          draggedKey: event.draggedKey,
          pointerPosition,
          sourceRect: measureDomElement(sourceElement),
          content: renderDragListOverlayContent(item),
          placement: "left-top",
        });

        if (overlay) {
          recalculateTargets(overlay.overlayRect);
        }
      }
    },
    onDragUpdate: (event, { recalculateTargets }) => {
      const overlayRect = overlay?.move(event.pointerPosition) ?? null;
      if (overlay) {
        recalculateTargets(overlayRect);
      } else {
        recalculateTargets();
      }

      if (
        !shouldMoveSortablePreview({
          draggedKey: event.draggedKey,
          activeDropTargetKey: event.activeDropTargetKey,
          previousDropTargetKey: event.previousDropTargetKey,
        })
      ) {
        return;
      }

      moveSortablePreview({
        listElement: list,
        draggedKey: event.draggedKey,
        activeDropTargetKey: event.activeDropTargetKey,
        getItemElement,
      });
      session.dropTargets = measureSortableDropTargets(
        dragListItems,
        getItemElement,
      );
      if (overlay) {
        recalculateTargets(overlayRect);
      }
    },
    onDragEnd: ({ draggedKey, dropTargetKey }) => {
      overlay?.remove();
      overlay = null;

      setDragListItemGhosted({
        itemId: draggedKey,
        isGhosted: false,
        getItemElement,
      });

      if (dropTargetKey === null) {
        restoreSortableDraggedItem({
          listElement: list,
          draggedKey,
          items: dragListItems,
          getItemKey: (item) => item.id,
          getItemOrderKey: (item) => item.orderKey,
          getItemElement,
        });
      }
    },
    onDrop: ({ draggedKey }) => {
      overlay?.remove();
      overlay = null;

      applySortableDrop({
        listElement: list,
        draggedKey,
        items: dragListItems,
        getItemKey: (item) => item.id,
        getItemOrderKey: (item) => item.orderKey,
        setItemOrderKey: (item, orderKey) => {
          item.orderKey = orderKey;
        },
        getItemElement,
      });
    },
  });

  list.addEventListener("pointerdown", dragHandler);
}

function measureSortableDropTargets(
  items: readonly DragListItem[],
  getItemElement: (itemId: string) => HTMLElement | null,
): DomDragSession["dropTargets"] {
  const dropTargets: DomDragSession["dropTargets"] = new Map();

  for (const item of items) {
    const element = getItemElement(item.id);

    if (element) {
      dropTargets.set(item.id, measureDomElement(element));
    }
  }

  return dropTargets;
}
