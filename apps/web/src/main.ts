import "./style.css";

import type { DragListItemPayload } from "./custom/types";

import { applyDrop } from "./custom/reordering/apply-drop";
import { getDragListEntryId } from "./custom/get-drag-list-entry-id";
import { getOrderedDragListEntries } from "./custom/reordering/get-ordered-drag-list-entries";
import { renderChangedItemInOrder } from "./custom/reordering/render-changed-item-in-order";
import { setDragListDropTarget } from "./custom/reordering/set-drag-list-drop-target";
import { dragListItems } from "./custom/mock-data";
import { renderCustomOverlay } from "./custom/render-custom-overlay";
import { renderDragListEntry } from "./custom/render-drag-list-entry";
import { getDropTargetId } from "./custom/get-drop-target-id";
import { renderDropTarget } from "./custom/render-drop-target";
import { pointerToCenter } from "./core/targeting/pointer-to-center";
import { createDragRuntime } from "./core/runtime/createDragRuntime";
import { createDomDragHandler } from "./dom/create-dom-drag-handler";


const app = document.querySelector<HTMLDivElement>("#app")!;

const dragRuntime = createDragRuntime<DragListItemPayload>();

renderApp();

function renderApp(): void {
  const dragListEntries = getOrderedDragListEntries();
  const dragListMarkup = dragListEntries
    .map(([itemId, item], dropTargetIndex) => {
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
          itemId,
          item,
        })}
      `;
    })
    .join("");

  const endDropTargetId = getDropTargetId(dragListEntries.length);
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
      targetingAlgorithm: pointerToCenter,
      getPayload: (itemId) => {
        const item = dragListItems[itemId];

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

        renderChangedItemInOrder({
          items: dragListItems,
          itemId: changedItemId,
        });
      },
    }),
  );
}
