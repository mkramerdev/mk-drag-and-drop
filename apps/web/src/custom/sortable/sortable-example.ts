import type { DragListItemPayload } from "../shared/list-data";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "../shared/list-data";
import { setDragListItemGhosted } from "../shared/list-drag-effects";
import { renderDragListOverlayContent } from "../shared/list-overlay";
import { centerToCenter, createDragRuntime } from "../../core";
import {
  createDomDragController,
  createDomDragHandler,
  createDomDragSession,
} from "../../dom";
import { applySortableDrop } from "./sortable-drop";
import {
  moveSortablePreview,
  restoreSortableDraggedItem,
} from "./sortable-preview";
import {
  createSortableItemElement,
  getSortableItemElement,
} from "./sortable-render";

export function mountSortableExample(parent: HTMLElement): void {
  const runtime = createDragRuntime<DragListItemPayload>();
  const session = createDomDragSession();
  const controller = createDomDragController();
  const list = document.createElement("div");
  const itemsInOrder = getOrderedDragListItems();

  list.id = "demo-sortable-list";
  list.className = "drag-parent";
  list.dataset.dndListId = "demo-sortable-list";

  for (const item of itemsInOrder) {
    list.append(createSortableItemElement(item));
  }

  parent.replaceChildren(list);

  const dragHandler = createDomDragHandler({
    runtime,
    session,
    controller,
    renderOverlayContent: renderDragListOverlayContent,
    overlayPlacement: "left-center",
    targetingAlgorithm: centerToCenter,
    getDraggedElement: getSortableItemElement,
    getPayload: (itemId) => {
      const item = findDragListItem(dragListItems, itemId);

      if (!item) {
        return null;
      }

      return {
        content: item.content,
      };
    },
    onDragStart: ({ draggedKey }) => {
      setDragListItemGhosted({
        itemId: draggedKey,
        isGhosted: true,
        getItemElement: getSortableItemElement,
      });
    },
    onDragUpdate: ({
      draggedKey,
      activeDropTargetKey,
      previousDropTargetKey,
    }) => {
      if (
        activeDropTargetKey === null ||
        activeDropTargetKey === previousDropTargetKey ||
        activeDropTargetKey === draggedKey
      ) {
        return;
      }

      moveSortablePreview({
        listElement: list,
        draggedKey,
        activeDropTargetKey,
      });
      controller.requestDropTargetRemeasure();
    },
    onDragEnd: ({ draggedKey, dropTargetKey }) => {
      setDragListItemGhosted({
        itemId: draggedKey,
        isGhosted: false,
        getItemElement: getSortableItemElement,
      });

      if (dropTargetKey === null) {
        restoreSortableDraggedItem({
          listElement: list,
          draggedKey,
        });
      }
    },
    onDrop: ({ draggedKey }) => {
      applySortableDrop({
        listElement: list,
        draggedKey,
      });
    },
  });

  list.addEventListener("pointerdown", dragHandler.handlePointerDown);
}
