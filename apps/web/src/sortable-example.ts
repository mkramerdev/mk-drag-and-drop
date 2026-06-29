import type { DragListItem, DragListItemPayload } from "./custom/list-data";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./custom/list-data";
import { generateKeyBetween } from "./custom/fractional-indexing";
import { setDragListItemGhosted } from "./custom/list-drag-effects";
import { renderDragListOverlayContent } from "./custom/list-render";
import { centerToCenter, createDragRuntime } from "./core";
import { createDomDragHandler } from "./dom";

const dragRuntime = createDragRuntime<DragListItemPayload>();

type SortablePreviewSession = {
  listElement: HTMLElement;
  draggedElement: HTMLElement;
  originalChildren: HTMLElement[];
};

let previewSession: SortablePreviewSession | null = null;

export function mountSortableExample(parent: HTMLElement): void {
  const list = document.createElement("div");
  const itemsInOrder = getOrderedDragListItems();

  list.id = "demo-sortable-list";
  list.className = "drag-parent";
  list.dataset.dndListId = "demo-sortable-list";

  for (const item of itemsInOrder) {
    list.append(createSortableItemElement(item));
  }

  parent.replaceChildren(list);

  list.addEventListener(
    "pointerdown",
    createDomDragHandler({
      runtime: dragRuntime,
      renderOverlayContent: renderDragListOverlayContent,
      overlayPlacement: "left-center",
      targetingAlgorithm: centerToCenter,
      remeasureDropTargetsOnDragUpdate: true,
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
      onDragUpdate: ({
        activeDropTargetKey,
        previousDropTargetKey,
      }) => {
        if (activeDropTargetKey === previousDropTargetKey) {
          return;
        }

        moveSortablePreview(activeDropTargetKey);
      },
      onDragEnd: ({ draggedKey, dropTargetKey }) => {
        setDragListItemGhosted({
          itemId: draggedKey,
          isGhosted: false,
          getItemElement: getSortableItemElement,
        });

        if (dropTargetKey === null) {
          restoreSortablePreview();
        }
      },
      onDrop: ({ draggedKey }) => {
        applySortableDrop(draggedKey);
        previewSession = null;
      },
    }),
  );
}

function createSortableItemElement(item: DragListItem): HTMLElement {
  const element = document.createElement("div");

  element.id = getSortableElementId(item.id);
  element.className = "dragListItem";
  element.dataset.dndDragKey = item.id;
  element.dataset.dndDropTargetKey = item.id;
  element.dataset.dndItemId = item.id;
  element.dataset.orderKey = item.orderKey;

  const dragHandle = document.createElement("div");
  dragHandle.id = `${getSortableElementId(item.id)}-drag-handle`;
  dragHandle.className = "dragListHandle";
  dragHandle.dataset.dndDragKey = item.id;

  const text = document.createElement("div");
  text.className = "dragListItemText";
  text.textContent = item.content;

  element.append(dragHandle, text);

  return element;
}

function getSortableElementId(itemId: string): string {
  return `sortable-${itemId}`;
}

function getSortableItemElement(itemId: string): HTMLElement | null {
  return document.getElementById(getSortableElementId(itemId));
}

function createSortablePreviewSession(input: {
  listElement: HTMLElement;
  draggedKey: string;
}): SortablePreviewSession | null {
  const draggedElement = getSortableItemElement(input.draggedKey);

  if (!draggedElement) {
    return null;
  }

  return {
    listElement: input.listElement,
    draggedElement,
    originalChildren: Array.from(input.listElement.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    ),
  };
}

function moveSortablePreview(activeDropTargetKey: string | null): void {
  if (!previewSession || activeDropTargetKey === null) {
    return;
  }

  const targetElement = getSortableItemElement(activeDropTargetKey);

  if (
    !targetElement ||
    targetElement === previewSession.draggedElement ||
    targetElement.parentElement !== previewSession.listElement
  ) {
    return;
  }

  moveElementToTargetPosition(previewSession.draggedElement, targetElement);
}

function moveElementToTargetPosition(
  draggedElement: HTMLElement,
  targetElement: HTMLElement,
): void {
  const documentPosition = draggedElement.compareDocumentPosition(targetElement);

  if (documentPosition & Node.DOCUMENT_POSITION_FOLLOWING) {
    targetElement.after(draggedElement);
    return;
  }

  if (documentPosition & Node.DOCUMENT_POSITION_PRECEDING) {
    targetElement.before(draggedElement);
  }
}

function restoreSortablePreview(): void {
  if (!previewSession) {
    return;
  }

  previewSession.listElement.replaceChildren(...previewSession.originalChildren);
  previewSession = null;
}

function applySortableDrop(draggedKey: string): void {
  if (!previewSession || isSortablePreviewInOriginalOrder(previewSession)) {
    restoreSortablePreview();
    return;
  }

  const draggedItem = findDragListItem(dragListItems, draggedKey);
  const draggedElement = previewSession.draggedElement;
  const previousOrderKey = getSortableSiblingOrderKey(
    draggedElement.previousElementSibling,
  );
  const nextOrderKey = getSortableSiblingOrderKey(
    draggedElement.nextElementSibling,
  );

  if (!draggedItem) {
    restoreSortablePreview();
    return;
  }

  draggedItem.orderKey = generateKeyBetween(previousOrderKey, nextOrderKey);
  draggedElement.dataset.orderKey = draggedItem.orderKey;
}

function isSortablePreviewInOriginalOrder(
  session: SortablePreviewSession,
): boolean {
  const currentChildren = Array.from(session.listElement.children);

  return session.originalChildren.every((child, index) => {
    return currentChildren[index] === child;
  });
}

function getSortableSiblingOrderKey(
  element: Element | null,
): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  return element.dataset.orderKey ?? null;
}
