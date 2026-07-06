import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createSortable,
  lockToYAxis,
  maxOverlayCenterDistanceToRect,
  type DragControllerOverlayInput,
  type DragRect,
} from "@mk-drag-and-drop/dom";

import { moveItemToSortablePlacement } from "./sortablePlacement";

const defaultItems = ["1", "2", "3", "4", "5"];
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const dragHandleText = "\u22ee\u22ee";
const sortableDraggableIdAttribute = "data-vanilla-sortable-item-id";

export function mountSortableList(root: HTMLElement): () => void {
  const pendingAnimationFrames = new Set<number>();
  // Example state: the app owns item order, active styling, and release geometry.
  let items = [...defaultItems];
  let activeItemId: string | null = null;
  let releaseTargetRect: DragRect | null = null;
  let releaseOverlayCleanup: (() => void) | null = null;

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
    cleanupReleaseOverlay();
    cancelPendingAnimationFrames();
    root.replaceChildren();
  };

  // Example rendering: list markup is app-owned and rerendered from data.
  function renderItems(): void {
    listElement.replaceChildren(
      ...items.map((draggableId) => createSortableItem(draggableId)),
    );
    updateItemDraggingClasses();
  }

  // Example styling: active item classes drive demo CSS highlights.
  function updateItemDraggingClasses(): void {
    listElement
      .querySelectorAll<HTMLElement>(`[${sortableDraggableIdAttribute}]`)
      .forEach((element) => {
        element.classList.toggle(
          "sortableItemDragging",
          element.getAttribute(sortableDraggableIdAttribute) === activeItemId,
        );
      });
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
      placementBoundary: {
        start: 0,
        end: 1,
      },
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
