import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createSortable,
  lockToYAxis,
  maxOverlayCenterDistanceToRect,
  type DragControllerOverlayInput,
  type DragRect,
  type SortableDropPlacement,
} from "@mk-drag-and-drop/dom";

import { moveItemToSortablePlacement } from "./sortablePlacement";

const defaultItems = Array.from({ length: 10_000 }, (_, index) =>
  String(index + 1),
);
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const dragHandleText = "\u22ee\u22ee";
const sortableDraggableIdAttribute = "data-vanilla-sortable-item-id";

export function mountSortablePerformanceExample(root: HTMLElement): () => void {
  const pendingAnimationFrames = new Set<number>();
  // Example state: the app owns item order, active styling, and release geometry.
  let items = [...defaultItems];
  let activeItemId: string | null = null;
  let renderedActiveItemId: string | null = null;
  let releaseTargetRect: DragRect | null = null;
  let releaseOverlayCleanup: (() => void) | null = null;
  const itemElements = new Map<string, HTMLElement>();

  // Package API: creates the drag controller used by this vanilla example.
  const controller = createDragController({
    overlayRelease: "manual",
    modifiers: [lockToYAxis()],
    targetingAlgorithm: centerToCenter,
    targetingConstraint: maxOverlayCenterDistanceToRect({ maxDistance: 96 }),
    dragOverlay: createDragOverlay,
    onDragStart({ draggableId }) {
      activeItemId = draggableId;
      releaseTargetRect = null;
      updateItemDraggingClasses();
    },
    onDragEnd({ dropTargetId }, { getDropTargetRect }) {
      releaseTargetRect = dropTargetId
        ? getDropTargetRect(dropTargetId)
        : null;

      if (dropTargetId !== null) {
        return;
      }

      activeItemId = null;
      updateItemDraggingClasses();
    },
    onDrop({ draggableId, sortablePlacement }) {
      const placement = sortablePlacement;

      if (!placement) {
        return;
      }

      // Example drop behavior: translate package sortable placement into app data.
      items = moveItemToSortablePlacement(items, draggableId, placement);
      moveItemElementToSortablePlacement(draggableId, placement);
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
    cleanupReleaseOverlay();
    cancelPendingAnimationFrames();
    itemElements.clear();
    renderedActiveItemId = null;
    root.replaceChildren();
  };

  // Example rendering: list markup is app-owned and rerendered from data.
  function renderItems(): void {
    const currentIds = new Set(items);
    let shouldSyncDom = listElement.childElementCount !== items.length;

    for (const [draggableId, element] of Array.from(itemElements)) {
      if (!currentIds.has(draggableId)) {
        element.remove();
        itemElements.delete(draggableId);
        shouldSyncDom = true;
      }
    }

    for (let index = 0; index < items.length; index += 1) {
      const draggableId = items[index];

      if (draggableId === undefined) {
        continue;
      }

      let element = itemElements.get(draggableId);

      if (!element) {
        element = createSortableItem(draggableId);
        itemElements.set(draggableId, element);
        shouldSyncDom = true;
      }

      if (!shouldSyncDom && listElement.children.item(index) !== element) {
        shouldSyncDom = true;
      }
    }

    if (shouldSyncDom) {
      const fragment = document.createDocumentFragment();

      for (const draggableId of items) {
        const element = itemElements.get(draggableId);

        if (element) {
          fragment.append(element);
        }
      }

      listElement.replaceChildren(fragment);
    }

    updateItemDraggingClasses();
  }

  // Example styling: active item classes drive demo CSS highlights.
  function updateItemDraggingClasses(): void {
    if (renderedActiveItemId === activeItemId) {
      return;
    }

    if (renderedActiveItemId !== null) {
      itemElements
        .get(renderedActiveItemId)
        ?.classList.remove("sortableItemDragging");
    }

    if (activeItemId !== null) {
      itemElements.get(activeItemId)?.classList.add("sortableItemDragging");
    }

    renderedActiveItemId = activeItemId;
  }

  function moveItemElementToSortablePlacement(
    draggableId: string,
    placement: SortableDropPlacement,
  ): void {
    const element = itemElements.get(draggableId);

    if (!element) {
      return;
    }

    if (placement.targetDraggableId !== null && placement.side !== null) {
      const target = itemElements.get(placement.targetDraggableId);

      if (!target) {
        return;
      }

      if (placement.side === "after") {
        target.after(element);
      } else {
        target.before(element);
      }

      return;
    }

    if (placement.previousDraggableId !== null) {
      const previous = itemElements.get(placement.previousDraggableId);

      if (previous) {
        previous.after(element);
      }

      return;
    }

    if (placement.nextDraggableId !== null) {
      const next = itemElements.get(placement.nextDraggableId);

      if (next) {
        next.before(element);
      }

      return;
    }

    listElement.append(element);
  }

  function createSortableItem(draggableId: string): HTMLElement {
    // Example rendering: item markup is app-owned.
    const element = document.createElement("div");
    element.className =
      activeItemId === draggableId
        ? "sortableItem sortableItemDragging"
        : "sortableItem";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "dragListHandle";
    handle.setAttribute("aria-label", "Drag item");
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.textContent = `Item ${draggableId}`;

    element.append(handle, label);
    element.setAttribute(sortableDraggableIdAttribute, draggableId);

    // Package API: registers this DOM node and handle as sortable.
    createSortable({
      controller,
      element,
      draggableId,
      group: getSortableGroup(draggableId),
    });
    createDragHandle({ element: handle });

    return element;
  }

  function createDragOverlay(input: DragControllerOverlayInput): HTMLElement | null {
    const { dragState, phase } = input;

    // Example rendering: overlay markup and release animation are app-owned.
    if (phase === "released" && !releaseTargetRect) {
      cleanupReleaseOverlay();
      activeItemId = null;
      releaseTargetRect = null;
      input.removeOverlay();
      renderItems();
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className =
      phase === "released"
        ? "sortableOverlay sortableOverlayReleasing"
        : "sortableOverlay";
    appendOverlayContents(overlay, dragState.draggableId);

    if (phase === "released") {
      setupReleaseOverlay(overlay, input.removeOverlay);
    } else {
      cleanupReleaseOverlay();
    }

    return overlay;
  }

  function setupReleaseOverlay(
    overlay: HTMLElement,
    removeOverlay: () => void,
  ): void {
    const targetRect = releaseTargetRect;
    cleanupReleaseOverlay();

    if (!targetRect) {
      activeItemId = null;
      releaseTargetRect = null;
      removeOverlay();
      renderItems();
      return;
    }

    let completed = false;
    let active = true;
    let animationFrameId: number | null = null;
    let animations: Animation[] = [];

    const clearReleaseOverlay = (): void => {
      active = false;

      if (animationFrameId !== null) {
        cancelAnimationFrameId(animationFrameId);
        animationFrameId = null;
      }

      for (const animation of animations) {
        animation.cancel();
      }

      animations = [];

      if (releaseOverlayCleanup === clearReleaseOverlay) {
        releaseOverlayCleanup = null;
      }

      releaseTargetRect = null;
    };

    const completeReleaseOverlay = (): void => {
      if (completed || !active) {
        return;
      }

      completed = true;
      clearReleaseOverlay();
      activeItemId = null;
      removeOverlay();
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

      overlay.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      animations = overlay.getAnimations();

      if (animations.length === 0) {
        completeReleaseOverlay();
        return;
      }

      void Promise.all(
        animations.map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      ).then(() => {
        if (active) {
          completeReleaseOverlay();
        }
      });
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

}

// Example rendering: overlay content is app-owned.
function appendOverlayContents(element: HTMLElement, draggableId: string): void {
  const handle = document.createElement("div");
  handle.className = "dragListHandle";
  handle.textContent = dragHandleText;

  const label = document.createElement("span");
  label.textContent = `Item ${draggableId}`;

  element.append(handle, label);
}

function getSortableGroup(draggableId: string): string {
  return draggableId === "3" ? isolatedSortableGroup : sortableGroup;
}
