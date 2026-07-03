import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createSortable,
  lockToYAxis,
  maxDistanceToRect,
  type DragController,
  type DragControllerOverlayInput,
  type DragRect,
  type SortablePlacement,
} from "@mk-drag-and-drop/dom";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const dragHandleText = "\u2630";
const releaseFallbackMs = 260;

export function mountSortableList(root: HTMLElement): () => void {
  const itemCleanups: Array<() => void> = [];
  const itemElements = new Map<string, HTMLElement>();
  const pendingAnimationFrames = new Set<number>();
  const pendingTimeouts = new Set<number>();
  const eventListenerCleanups = new Set<() => void>();
  let items = [...defaultItems];
  let overlayItemId: string | null = null;
  let overlayTargetRect: DragRect | null = null;
  let releaseOverlayCleanup: (() => void) | null = null;

  const controller = createDragController({
    keepOverlayOnDrop: true,
    modifiers: [lockToYAxis()],
    targetingAlgorithm: centerToCenter,
    targetingConstraint: maxDistanceToRect({ maxDistance: 96 }),
    dragOverlay: createDragOverlay,
    onDragStart({ itemId }) {
      overlayItemId = itemId;
      overlayTargetRect = null;
      updateItemDraggingClasses();
    },
    onDragEnd({ dropTarget }) {
      if (dropTarget !== null) {
        return;
      }

      overlayItemId = null;
      overlayTargetRect = null;
      updateItemDraggingClasses();
    },
    onDrop({ itemId }, { getDropTargetRect, getSortablePlacement }) {
      const placement = getSortablePlacement(itemId);

      overlayTargetRect = getDropTargetRect(itemId);

      if (!placement) {
        return;
      }

      items = moveItemToSortablePlacement(items, placement);
      renderItems();
    },
  });

  const panel = document.createElement("section");
  panel.className = "examplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Sortable list";

  const listElement = document.createElement("div");
  listElement.className = "sortableParent";

  panel.append(title, listElement);
  root.append(panel);
  renderItems();

  return () => {
    controller.dispose();
    runItemCleanups();
    cleanupReleaseOverlay();
    cancelPendingAnimationFrames();
    cancelPendingTimeouts();
    removeEventListeners();
    root.replaceChildren();
  };

  function registerItemCleanup(cleanup: () => void): void {
    itemCleanups.push(cleanup);
  }

  function runItemCleanups(): void {
    for (const cleanup of itemCleanups.splice(0).reverse()) {
      cleanup();
    }

    itemElements.clear();
  }

  function renderItems(): void {
    runItemCleanups();
    listElement.replaceChildren(
      ...items.map((itemId) => createSortableItem(controller, itemId)),
    );
    updateItemDraggingClasses();
  }

  function updateItemDraggingClasses(): void {
    for (const [itemId, element] of itemElements) {
      element.classList.toggle("sortableItemDragging", overlayItemId === itemId);
    }
  }

  function createSortableItem(
    dragController: DragController,
    itemId: string,
  ): HTMLElement {
    const element = document.createElement("div");
    element.className =
      overlayItemId === itemId
        ? "sortableItem sortableItemDragging"
        : "sortableItem";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "dragListHandle";
    handle.setAttribute("aria-label", "Drag item");
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.textContent = `Item ${itemId}`;

    element.append(handle, label);
    itemElements.set(itemId, element);

    registerItemCleanup(
      createSortable({
        controller: dragController,
        element,
        itemId,
        group: getSortableGroup(itemId),
      }),
    );
    registerItemCleanup(createDragHandle({ element: handle }));

    return element;
  }

  function createDragOverlay({
    dragState,
    phase,
    finish,
  }: DragControllerOverlayInput): HTMLElement | null {
    const currentOverlayItemId = overlayItemId ?? dragState.itemId;

    if (!currentOverlayItemId) {
      cleanupReleaseOverlay();
      finish();
      return null;
    }

    if (phase === "released" && !overlayTargetRect) {
      cleanupReleaseOverlay();
      overlayItemId = null;
      overlayTargetRect = null;
      finish();
      renderItems();
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className =
      phase === "released"
        ? "sortableOverlay sortableOverlayReleasing"
        : "sortableOverlay";
    appendOverlayContents(overlay, currentOverlayItemId);

    if (phase === "released") {
      setupReleaseOverlay(overlay, finish);
    } else {
      cleanupReleaseOverlay();
    }

    return overlay;
  }

  function setupReleaseOverlay(
    overlay: HTMLElement,
    finish: () => void,
  ): void {
    cleanupReleaseOverlay();

    const targetRect = overlayTargetRect;

    if (!targetRect) {
      overlayItemId = null;
      overlayTargetRect = null;
      finish();
      renderItems();
      return;
    }

    let completed = false;
    let animationFrameId: number | null = null;
    let fallbackTimeoutId: number | null = null;
    let transitionCleanup: (() => void) | null = null;

    const clearReleaseOverlay = (): void => {
      if (animationFrameId !== null) {
        cancelAnimationFrameId(animationFrameId);
        animationFrameId = null;
      }

      if (fallbackTimeoutId !== null) {
        cancelTimeoutId(fallbackTimeoutId);
        fallbackTimeoutId = null;
      }

      transitionCleanup?.();
      transitionCleanup = null;

      if (releaseOverlayCleanup === clearReleaseOverlay) {
        releaseOverlayCleanup = null;
      }
    };

    const completeReleaseOverlay = (): void => {
      if (completed) {
        return;
      }

      completed = true;
      clearReleaseOverlay();
      overlayItemId = null;
      overlayTargetRect = null;
      finish();
      renderItems();
    };

    animationFrameId = scheduleAnimationFrame(() => {
      animationFrameId = null;

      if (!overlay.isConnected) {
        completeReleaseOverlay();
        return;
      }

      const overlayRect = overlay.getBoundingClientRect();
      const offset = {
        x: targetRect.left - overlayRect.left,
        y: targetRect.top - overlayRect.top,
      };

      if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) {
        completeReleaseOverlay();
        return;
      }

      transitionCleanup = addManagedEventListener(
        overlay,
        "transitionend",
        (event) => {
          const transitionEvent = event as TransitionEvent;

          if (
            event.target !== overlay ||
            transitionEvent.propertyName !== "transform"
          ) {
            return;
          }

          completeReleaseOverlay();
        },
      );
      fallbackTimeoutId = scheduleTimeout(
        completeReleaseOverlay,
        releaseFallbackMs,
      );
      overlay.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
    });
    releaseOverlayCleanup = clearReleaseOverlay;
  }

  function cleanupReleaseOverlay(): void {
    releaseOverlayCleanup?.();
  }

  function scheduleAnimationFrame(callback: FrameRequestCallback): number {
    const animationFrameId = window.requestAnimationFrame((time) => {
      pendingAnimationFrames.delete(animationFrameId);
      callback(time);
    });
    pendingAnimationFrames.add(animationFrameId);
    return animationFrameId;
  }

  function cancelAnimationFrameId(animationFrameId: number): void {
    window.cancelAnimationFrame(animationFrameId);
    pendingAnimationFrames.delete(animationFrameId);
  }

  function cancelPendingAnimationFrames(): void {
    for (const animationFrameId of Array.from(pendingAnimationFrames)) {
      cancelAnimationFrameId(animationFrameId);
    }
  }

  function scheduleTimeout(callback: () => void, timeout: number): number {
    const timeoutId = window.setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      callback();
    }, timeout);
    pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  function cancelTimeoutId(timeoutId: number): void {
    window.clearTimeout(timeoutId);
    pendingTimeouts.delete(timeoutId);
  }

  function cancelPendingTimeouts(): void {
    for (const timeoutId of Array.from(pendingTimeouts)) {
      cancelTimeoutId(timeoutId);
    }
  }

  function addManagedEventListener(
    element: EventTarget,
    type: string,
    listener: EventListener,
  ): () => void {
    element.addEventListener(type, listener);

    const cleanup = (): void => {
      element.removeEventListener(type, listener);
      eventListenerCleanups.delete(cleanup);
    };

    eventListenerCleanups.add(cleanup);
    return cleanup;
  }

  function removeEventListeners(): void {
    for (const cleanup of Array.from(eventListenerCleanups)) {
      cleanup();
    }
  }
}

function appendOverlayContents(element: HTMLElement, itemId: string): void {
  const handle = document.createElement("div");
  handle.className = "dragListHandle";
  handle.textContent = dragHandleText;

  const label = document.createElement("span");
  label.textContent = `Item ${itemId}`;

  element.append(handle, label);
}

function getSortableGroup(itemId: string): string {
  return itemId === "3" ? isolatedSortableGroup : sortableGroup;
}

function moveItemToSortablePlacement(
  items: readonly string[],
  placement: SortablePlacement,
): string[] {
  const withoutItem = items.filter((item) => item !== placement.itemId);

  if (placement.previousItemId !== null) {
    const previousIndex = withoutItem.indexOf(placement.previousItemId);

    if (previousIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, previousIndex + 1),
      placement.itemId,
      ...withoutItem.slice(previousIndex + 1),
    ];
  }

  if (placement.nextItemId !== null) {
    const nextIndex = withoutItem.indexOf(placement.nextItemId);

    if (nextIndex === -1) {
      return [...items];
    }

    return [
      ...withoutItem.slice(0, nextIndex),
      placement.itemId,
      ...withoutItem.slice(nextIndex),
    ];
  }

  return [...items];
}
