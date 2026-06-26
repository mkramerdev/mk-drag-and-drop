import "./style.css";

import type { DragListItemPayload } from "./custom/list-data";

import { commitChangedItemInOrder } from "./custom/list-commit";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./custom/list-data";
import { applyDrop, setDragListDropTarget } from "./custom/list-drop";
import {
  getDragListEntryId,
  getDropTargetId,
  renderCustomOverlay,
  renderDragListEntry,
  renderDropTarget,
} from "./custom/list-render";
import { pointerToCenter } from "./core/targeting/pointer-to-center";
import { createDragRuntime } from "./core/runtime/createDragRuntime";
import { createDomDragHandler } from "./dom/create-dom-drag-handler";


const app = document.querySelector<HTMLDivElement>("#app")!;

const dragRuntime = createDragRuntime<DragListItemPayload>();

renderApp();

function renderApp(): void {
  const dragListItemsInOrder = getOrderedDragListItems();
  const dragListMarkup = dragListItemsInOrder
    .map((item, dropTargetIndex) => {
      const itemId = item.id;
      const dropTargetId = getDropTargetId(dropTargetIndex);
      const entryId = getDragListEntryId(itemId);
      setDragListDropTarget({
        dropTargetId,
        beforeItemId: itemId,
      });

      return `
        ${renderDragListEntry({
          entryId,
          dropTargetId,
          item,
        })}
      `;
    })
    .join("");

  const endDropTargetId = getDropTargetId(dragListItemsInOrder.length);
  setDragListDropTarget({
    dropTargetId: endDropTargetId,
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
      ${renderDropTarget({ dropTargetId: endDropTargetId })}
    </div>
  `;

  const dragList = document.querySelector<HTMLDivElement>("#demo-drag-list")!;

  dragList.addEventListener(
    "pointerdown",
    createDomDragHandler({
      runtime: dragRuntime,
      renderOverlay: renderCustomOverlay,
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
      onDrop: ({ draggedKey, dropTargetKey }) => {
        const changedItemId = applyDrop({ draggedKey, dropTargetKey });

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
