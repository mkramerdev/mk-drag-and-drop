import "./style.css";

import type { DragListItemPayload } from "./custom/list-data";

import { commitChangedItemInOrder } from "./custom/list-commit";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./custom/list-data";
import { setDragListItemGhosted } from "./custom/list-drag-effects";
import { applyDragListDrop, setDragListDropTarget } from "./custom/list-drop";
import {
  getDragListDropTargetKey,
  renderDragListItem,
  renderDragListDropTarget,
  renderDragListOverlayContent,
} from "./custom/list-render";
import { pointerToCenter } from "./core/targeting/pointer-to-center";
import { createDragRuntime } from "./core/runtime/create-drag-runtime";
import { createDomDragHandler } from "./dom/create-dom-drag-handler";

const app = document.querySelector<HTMLDivElement>("#app")!;

const dragRuntime = createDragRuntime<DragListItemPayload>();

renderApp();

function renderApp(): void {
  const dragListItemsInOrder = getOrderedDragListItems();
  const dragListMarkup = dragListItemsInOrder
    .map((item, dropTargetIndex) => {
      const itemId = item.id;
      const dropTargetKey = getDragListDropTargetKey(dropTargetIndex);
      setDragListDropTarget({
        dropTargetKey,
        beforeItemId: itemId,
      });

      return `
        ${renderDragListDropTarget({ dropTargetKey })}
        ${renderDragListItem(item)}
      `;
    })
    .join("");

  const endDropTargetKey = getDragListDropTargetKey(dragListItemsInOrder.length);
  setDragListDropTarget({
    dropTargetKey: endDropTargetKey,
    beforeItemId: null,
  });

  app.innerHTML = `
    <div
      id="demo-drag-list"
      class="drag-parent"
      data-dnd-list-id="demo-drag-list"
      data-dnd-is-dragging="${dragRuntime.isDragging}"
    >
      ${dragListMarkup}
      ${renderDragListDropTarget({ dropTargetKey: endDropTargetKey })}
    </div>
  `;

  const dragList = document.querySelector<HTMLDivElement>("#demo-drag-list")!;

  dragList.addEventListener(
    "pointerdown",
    createDomDragHandler({
      runtime: dragRuntime,
      renderOverlayContent: renderDragListOverlayContent,
      overlayPlacement: "left-center",
      targetingAlgorithm: pointerToCenter,
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
        setDragListItemGhosted(draggedKey, true);
      },
      onDragEnd: ({ draggedKey }) => {
        setDragListItemGhosted(draggedKey, false);
      },
      onDrop: ({ draggedKey, dropTargetKey }) => {
        const changedItemId = applyDragListDrop({
          draggedItemId: draggedKey,
          dropTargetKey,
        });

        if (!changedItemId) {
          return;
        }

        commitChangedItemInOrder({
          items: dragListItems,
          itemId: changedItemId,
        });
      },
    }),
  );
}
