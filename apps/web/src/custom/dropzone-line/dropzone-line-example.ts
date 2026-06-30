import { commitChangedItemInOrder } from "./list-commit";
import {
  findDragListItem,
  getOrderedDragListItems,
  dragListItems,
} from "../shared/list-data";
import { setDragListItemGhosted } from "../shared/list-drag-effects";
import {
  applyDragListDrop,
  createDragListDropTargetRegistry,
} from "./list-drop";
import {
  createDragListDropTargetElement,
  createDragListItemElement,
  getDragListDropTargetKey,
} from "./list-render";
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

const dragRuntime = createDragRuntime();

export function mountDropzoneLineExample(parent: HTMLElement): void {
  const dragSession = createDomDragSession();
  let overlay: DragListOverlay | null = null;
  const dragList = document.createElement("div");
  const dragListItemsInOrder = getOrderedDragListItems();
  const dropTargets = createDragListDropTargetRegistry();

  dragList.className = "drag-parent";
  dragList.dataset.dndIsDragging = String(dragRuntime.isDragging);

  for (const [dropTargetIndex, item] of dragListItemsInOrder.entries()) {
    const itemId = item.id;
    const dropTargetKey = getDragListDropTargetKey(dropTargetIndex);
    dropTargets.setDropTarget({
      dropTargetKey,
      beforeItemId: itemId,
    });

    dragList.append(
      createDragListDropTargetElement(dropTargetKey),
      createDragListItemElement(item),
    );
  }

  const endDropTargetKey = getDragListDropTargetKey(dragListItemsInOrder.length);
  dropTargets.setDropTarget({
    dropTargetKey: endDropTargetKey,
    beforeItemId: null,
  });
  dragList.append(createDragListDropTargetElement(endDropTargetKey));
  parent.replaceChildren(dragList);
  dragSession.dropTargets = measureDropTargets(dragListItemsInOrder.length);

  const dragHandler = createDomDragHandler({
    runtime: dragRuntime,
    session: dragSession,
    targetingAlgorithm: centerToCenter,
    onDragStart: (event, { pointerPosition, recalculateTargets }) => {
      const item = findDragListItem(dragListItems, event.draggedKey);
      const sourceElement = getDropzoneLineItemElement(event.draggedKey);

      setDragListItemGhosted({
        itemId: event.draggedKey,
        isGhosted: true,
        getItemElement: getDropzoneLineItemElement,
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
      if (!overlay) {
        return;
      }

      recalculateTargets(overlay.move(event.pointerPosition));
    },
    onDragEnd: ({ draggedKey }) => {
      overlay?.remove();
      overlay = null;

      setDragListItemGhosted({
        itemId: draggedKey,
        isGhosted: false,
        getItemElement: getDropzoneLineItemElement,
      });
    },
    onDrop: ({ draggedKey, dropTargetKey }) => {
      overlay?.remove();
      overlay = null;

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
  });

  dragList.addEventListener("pointerdown", dragHandler);
}

function getDropzoneLineItemElement(itemId: string): HTMLElement | null {
  return document.getElementById(itemId);
}

function measureDropTargets(itemCount: number): DomDragSession["dropTargets"] {
  const dropTargets: DomDragSession["dropTargets"] = new Map();

  for (
    let dropTargetIndex = 0;
    dropTargetIndex <= itemCount;
    dropTargetIndex++
  ) {
    const dropTargetKey = getDragListDropTargetKey(dropTargetIndex);
    const dropTargetElement = document.getElementById(dropTargetKey);

    if (dropTargetElement) {
      dropTargets.set(dropTargetKey, measureDomElement(dropTargetElement));
    }
  }

  return dropTargets;
}
