import type { DragListItemPayload } from "../shared/list-data";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "../shared/list-data";
import { setDragListItemGhosted } from "../shared/list-drag-effects";
import { renderDragListOverlayContent } from "../shared/list-overlay";
import { centerToCenter, createDragRuntime } from "../../core";
import { createDomDragHandler } from "../../dom";
import { applySortableDrop } from "./sortable-drop";
import {
  createSortablePreviewSession,
  moveSortablePreview,
  restoreSortablePreview,
  type SortablePreviewSession,
} from "./sortable-preview";
import {
  createSortableItemElement,
  getSortableItemElement,
} from "./sortable-render";

export function mountSortableExample(parent: HTMLElement): void {
  const dragRuntime = createDragRuntime<DragListItemPayload>();
  let previewSession: SortablePreviewSession | null = null;
  let dropTargetMeasurementKey = 0;
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
    runtime: dragRuntime,
    renderOverlayContent: renderDragListOverlayContent,
    overlayPlacement: "left-center",
    targetingAlgorithm: centerToCenter,
    getDropTargetMeasurementKey: () => dropTargetMeasurementKey,
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
      previewSession = createSortablePreviewSession({
        listElement: list,
        draggedKey,
      });
    },
    onDragUpdate: ({ activeDropTargetKey, previousDropTargetKey }) => {
      if (
        !previewSession ||
        activeDropTargetKey === null ||
        activeDropTargetKey === previousDropTargetKey ||
        activeDropTargetKey === previewSession.draggedKey
      ) {
        return;
      }

      moveSortablePreview({
        session: previewSession,
        activeDropTargetKey,
      });
      dropTargetMeasurementKey += 1;
    },
    onDragEnd: ({ draggedKey, dropTargetKey }) => {
      setDragListItemGhosted({
        itemId: draggedKey,
        isGhosted: false,
        getItemElement: getSortableItemElement,
      });

      if (previewSession && dropTargetKey === null) {
        restoreSortablePreview(previewSession);
        previewSession = null;
      }
    },
    onDrop: ({ draggedKey }) => {
      if (!previewSession) {
        return;
      }

      applySortableDrop({
        session: previewSession,
        draggedKey,
      });
      previewSession = null;
    },
  });

  list.addEventListener("pointerdown", dragHandler.handlePointerDown);
}
