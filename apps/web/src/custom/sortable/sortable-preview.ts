import { getSortableItemElement } from "./sortable-render";

export type SortablePreviewSession = {
  listElement: HTMLElement;
  draggedKey: string;
  draggedElement: HTMLElement;
  originalChildren: HTMLElement[];
  previewOrder: string[];
  itemElementsByKey: ReadonlyMap<string, HTMLElement>;
};

export function createSortablePreviewSession(input: {
  listElement: HTMLElement;
  draggedKey: string;
}): SortablePreviewSession | null {
  const draggedElement = getSortableItemElement(input.draggedKey);
  const originalChildren = getSortableItemChildren(input.listElement);
  const itemElementsByKey = new Map(
    originalChildren.map((element) => [getSortableItemKey(element), element]),
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
    previewOrder: originalChildren.map(getSortableItemKey),
    itemElementsByKey,
  };

  return session;
}

export function moveSortablePreview(input: {
  session: SortablePreviewSession;
  activeDropTargetKey: string | null;
}): void {
  if (input.activeDropTargetKey === null) {
    return;
  }

  const targetElement = getSortableItemElement(input.activeDropTargetKey);

  if (
    !targetElement ||
    targetElement.parentElement !== input.session.listElement
  ) {
    return;
  }

  const nextPreviewOrder = getNextSortablePreviewOrder(
    input.session.previewOrder,
    input.session.draggedKey,
    input.activeDropTargetKey,
  );

  if (!nextPreviewOrder) {
    return;
  }

  input.session.previewOrder = nextPreviewOrder;
  renderSortablePreview(input.session);
}

export function restoreSortablePreview(session: SortablePreviewSession): void {
  session.listElement.replaceChildren(...session.originalChildren);
}

export function isSortablePreviewInOriginalOrder(
  session: SortablePreviewSession,
): boolean {
  const currentChildren = Array.from(session.listElement.children);

  return session.originalChildren.every((child, index) => {
    return currentChildren[index] === child;
  });
}

function getSortableItemChildren(listElement: HTMLElement): HTMLElement[] {
  return Array.from(listElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.dndDropTargetKey !== undefined,
  );
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

function getSortableItemKey(element: HTMLElement): string {
  return element.dataset.dndDropTargetKey ?? "";
}
