import type { DragListItem, DragListItemPayload } from "./custom/list-data";
import {
  dragListItems,
  findDragListItem,
  getOrderedDragListItems,
} from "./custom/list-data";
import { generateKeyBetween } from "./custom/fractional-indexing";
import { setDragListItemGhosted } from "./custom/list-drag-effects";
import { renderDragListOverlayContent } from "./custom/list-render";
import {
  centerToCenter,
  createDragRuntime,
  type DragRect,
  type DropTarget,
} from "./core";
import { createDomDragHandler } from "./dom";

const dragRuntime = createDragRuntime<DragListItemPayload>();

type SortablePreviewSession = {
  listElement: HTMLElement;
  draggedKey: string;
  draggedElement: HTMLElement;
  originalChildren: HTMLElement[];
  previewOrder: string[];
  itemElementsByKey: ReadonlyMap<string, HTMLElement>;
  itemMeasurementsByKey: ReadonlyMap<string, SortableItemMeasurement>;
  layout: SortablePreviewLayout;
  dropTargets: DropTarget[];
};

type SortablePreviewLayout = {
  contentTop: number;
  contentLeft: number;
  rowGap: number;
};

type SortableItemMeasurement = {
  key: string;
  top: number;
  bottom: number;
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
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
      getDropTargets: () => previewSession?.dropTargets ?? [],
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
        remeasureDropTargets,
      }) => {
        if (activeDropTargetKey === previousDropTargetKey) {
          return;
        }

        if (moveSortablePreview(activeDropTargetKey)) {
          remeasureDropTargets();
        }
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
  const originalChildren = getSortableItemChildren(input.listElement);
  const itemMeasurements = measureSortableItems(originalChildren);
  const itemElementsByKey = new Map(
    originalChildren.map((element) => [
      element.dataset.dndDropTargetKey ?? "",
      element,
    ]),
  );
  const itemMeasurementsByKey = new Map(
    itemMeasurements.map((measurement) => [measurement.key, measurement]),
  );

  if (!draggedElement || !itemElementsByKey.has(input.draggedKey)) {
    return null;
  }

  itemElementsByKey.delete("");

  const session: SortablePreviewSession = {
    listElement: input.listElement,
    draggedKey: input.draggedKey,
    draggedElement,
    originalChildren,
    previewOrder: itemMeasurements.map((measurement) => measurement.key),
    itemElementsByKey,
    itemMeasurementsByKey,
    layout: measureSortablePreviewLayout(input.listElement, itemMeasurements),
    dropTargets: [],
  };

  session.dropTargets = createSortableVirtualDropTargets(session);

  return session;
}

function moveSortablePreview(activeDropTargetKey: string | null): boolean {
  if (!previewSession || activeDropTargetKey === null) {
    return false;
  }

  const targetElement = getSortableItemElement(activeDropTargetKey);

  if (
    !targetElement ||
    targetElement.parentElement !== previewSession.listElement
  ) {
    return false;
  }

  const nextPreviewOrder = getNextSortablePreviewOrder(
    previewSession.previewOrder,
    previewSession.draggedKey,
    activeDropTargetKey,
  );

  if (!nextPreviewOrder) {
    return false;
  }

  previewSession.previewOrder = nextPreviewOrder;
  previewSession.dropTargets = createSortableVirtualDropTargets(previewSession);
  renderSortablePreview(previewSession);

  return true;
}

function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
  return Array.from(listElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.dndDropTargetKey !== undefined,
  );
}

function measureSortableItems(
  itemElements: readonly HTMLElement[],
): SortableItemMeasurement[] {
  return itemElements
    .map((element) => {
      const key = element.dataset.dndDropTargetKey;

      if (!key) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return {
        key,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        marginTop: parseCssPixels(style.marginTop),
        marginBottom: parseCssPixels(style.marginBottom),
        marginLeft: parseCssPixels(style.marginLeft),
      };
    })
    .filter(
      (measurement): measurement is SortableItemMeasurement =>
        measurement !== null,
    );
}

function measureSortablePreviewLayout(
  listElement: HTMLElement,
  itemMeasurements: readonly SortableItemMeasurement[],
): SortablePreviewLayout {
  const rect = listElement.getBoundingClientRect();
  const style = window.getComputedStyle(listElement);

  return {
    contentTop:
      rect.top +
      parseCssPixels(style.borderTopWidth) +
      parseCssPixels(style.paddingTop),
    contentLeft:
      rect.left +
      parseCssPixels(style.borderLeftWidth) +
      parseCssPixels(style.paddingLeft),
    rowGap: measureSortableRowGap(itemMeasurements),
  };
}

function measureSortableRowGap(
  itemMeasurements: readonly SortableItemMeasurement[],
): number {
  let totalGap = 0;
  let gapCount = 0;

  for (let index = 1; index < itemMeasurements.length; index += 1) {
    const previousItem = itemMeasurements[index - 1]!;
    const item = itemMeasurements[index]!;
    const gap =
      item.top -
      previousItem.bottom -
      previousItem.marginBottom -
      item.marginTop;

    if (gap > 0) {
      totalGap += gap;
      gapCount += 1;
    }
  }

  return gapCount > 0 ? totalGap / gapCount : 0;
}

function createSortableVirtualDropTargets(
  session: SortablePreviewSession,
): DropTarget[] {
  const dropTargets: DropTarget[] = [];
  let nextTop = session.layout.contentTop;
  let hasPreviousItem = false;

  for (const key of session.previewOrder) {
    const measurement = session.itemMeasurementsByKey.get(key);

    if (!measurement) {
      continue;
    }

    if (hasPreviousItem) {
      nextTop += session.layout.rowGap;
    }

    nextTop += measurement.marginTop;

    dropTargets.push({
      dropTargetKey: key,
      dropTargetRect: createDragRect({
        left: session.layout.contentLeft + measurement.marginLeft,
        top: nextTop,
        width: measurement.width,
        height: measurement.height,
      }),
    });

    nextTop += measurement.height + measurement.marginBottom;
    hasPreviousItem = true;
  }

  return dropTargets;
}

function getNextSortablePreviewOrder(
  previewOrder: readonly string[],
  draggedKey: string,
  activeDropTargetKey: string,
): string[] | null {
  const draggedIndex = previewOrder.indexOf(draggedKey);
  const activeDropTargetIndex = previewOrder.indexOf(activeDropTargetKey);

  if (
    draggedIndex === -1 ||
    activeDropTargetIndex === -1 ||
    draggedIndex === activeDropTargetIndex
  ) {
    return null;
  }

  const nextPreviewOrder = [...previewOrder];
  nextPreviewOrder.splice(draggedIndex, 1);
  nextPreviewOrder.splice(activeDropTargetIndex, 0, draggedKey);

  return nextPreviewOrder;
}

function renderSortablePreview(session: SortablePreviewSession): void {
  const itemElements = session.previewOrder
    .map((key) => session.itemElementsByKey.get(key))
    .filter((element): element is HTMLElement => element !== undefined);

  if (itemElements.length !== session.previewOrder.length) {
    return;
  }

  session.listElement.replaceChildren(...itemElements);
}

function createDragRect(input: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DragRect {
  return {
    x: input.left,
    y: input.top,
    width: input.width,
    height: input.height,
    top: input.top,
    right: input.left + input.width,
    bottom: input.top + input.height,
    left: input.left,
  };
}

function parseCssPixels(value: string): number {
  const parsedValue = Number.parseFloat(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
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
