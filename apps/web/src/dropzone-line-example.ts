import type { DragListItemPayload } from "./custom/list-data";

import { commitChangedItemInOrder } from "./custom/list-commit";
import {
  findDragListItem,
  getOrderedDragListItems,
  dragListItems,
} from "./custom/list-data";
import { setDragListItemGhosted } from "./custom/list-drag-effects";
import {
  applyDragListDrop,
  createDragListDropTargetRegistry,
} from "./custom/list-drop";
import {
  createDragListDropTargetElement,
  createDragListItemElement,
  getDragListDropTargetKey,
  renderDragListOverlayContent,
} from "./custom/list-render";
import { centerToCenter, createDragRuntime } from "./core";
import { createDomDragHandler } from "./dom";

const dragRuntime = createDragRuntime<DragListItemPayload>();

export function mountDropzoneLineExample(parent: HTMLElement): void {
  const dragList = document.createElement("div");
  const dragListItemsInOrder = getOrderedDragListItems();
  const dropTargets = createDragListDropTargetRegistry();

  dragList.id = "demo-drag-list";
  dragList.className = "drag-parent";
  dragList.dataset.dndListId = "demo-drag-list";
  dragList.dataset.dndIsDragging = String(dragRuntime.isDragging);

  for (const [dropTargetIndex, item] of dragListItemsInOrder.entries()) {
    const itemId = item.id;
    const dropTargetKey = getDragListDropTargetKey(dropTargetIndex);
    dropTargets.setDropTarget({
      dropTargetKey,
      beforeItemId: itemId,
    });

    dragList.append(
      createDragListDropTargetElement({ dropTargetKey }),
      createDragListItemElement(item),
    );
  }

  const endDropTargetKey = getDragListDropTargetKey(dragListItemsInOrder.length);
  dropTargets.setDropTarget({
    dropTargetKey: endDropTargetKey,
    beforeItemId: null,
  });
  dragList.append(
    createDragListDropTargetElement({ dropTargetKey: endDropTargetKey }),
  );
  parent.replaceChildren(dragList);

  dragList.addEventListener(
    "pointerdown",
    createDomDragHandler({
      runtime: dragRuntime,
      renderOverlayContent: renderDragListOverlayContent,
      overlayPlacement: "left-center",
      targetingAlgorithm: centerToCenter,
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
          getItemElement: getDropzoneLineItemElement,
        });
      },
      onDragEnd: ({ draggedKey }) => {
        setDragListItemGhosted({
          itemId: draggedKey,
          isGhosted: false,
          getItemElement: getDropzoneLineItemElement,
        });
      },
      onDrop: ({ draggedKey, dropTargetKey }) => {
        const changedItemId = applyDragListDrop({
          items: dragListItems,
          dropTargets,
          draggedItemId: draggedKey,
          dropTargetKey,
        });

        if (!changedItemId) {
          return;
        }

        commitChangedItemInOrder({
          items: dragListItems,
          dropTargets,
          itemId: changedItemId,
        });
      },
    }),
  );
}

function getDropzoneLineItemElement(itemId: string): HTMLElement | null {
  return document.getElementById(itemId);
}
