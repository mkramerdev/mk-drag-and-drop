import {
  createDragController,
  createDraggable,
  createDroppable,
  createDragHandle,
  maxDistanceToRect,
  pointerToRectDistance,
  type DragController,
  type DragControllerOverlayInput,
  type DragRect,
} from "@mk-drag-and-drop/dom";

const draggableItem = {
  itemId: "draggable",
  label: "Item",
};

const rootContainer = {
  targetId: "droppable-root",
  label: "Drop Back Here",
};

const droppableContainer = {
  targetId: "droppable",
  label: "Drop Here",
};

const basicGroup = "basic";
const dragHandleText = "\u2630";
const releaseFallbackMs = 260;

export function mountBasicDrag(root: HTMLElement): () => void {
  const bindingCleanups: Array<() => void> = [];
  const pendingAnimationFrames = new Set<number>();
  const pendingTimeouts = new Set<number>();
  const eventListenerCleanups = new Set<() => void>();
  const dropzones = new Map<string, HTMLElement>();
  let overlayTargetRect: DragRect | null = null;
  let releaseOverlayCleanup: (() => void) | null = null;
  let movePreviewCleanup: (() => void) | null = null;
  let item: HTMLElement;

  const controller = createDragController({
    targetingAlgorithm: pointerToRectDistance,
    targetingConstraint: maxDistanceToRect({ maxDistance: 96 }),
    keepOverlayOnDrop: true,
    dragOverlay: createDragOverlay,
    onDragStart() {
      overlayTargetRect = null;
      clearActiveDropzones();
    },
    onDragUpdate({ activeDropTarget, previousDropTarget }) {
      updateActiveDropzone(activeDropTarget, previousDropTarget);
    },
    onDragEnd() {
      clearActiveDropzones();
    },
    onDrop({ itemId: droppedItemId, dropTarget }, { getDropTargetRect }) {
      if (
        droppedItemId !== draggableItem.itemId ||
        !isKnownDropTarget(dropTarget)
      ) {
        return;
      }

      if (dropTarget === getItemContainerId() || movePreviewCleanup) {
        return;
      }

      overlayTargetRect = getDropTargetRect(dropTarget);
      startMovePreview(dropTarget);
    },
  });

  const rootDropzone = createDropzone(
    controller,
    rootContainer.targetId,
    rootContainer.label,
    registerBindingCleanup,
  );
  const targetDropzone = createDropzone(
    controller,
    droppableContainer.targetId,
    droppableContainer.label,
    registerBindingCleanup,
  );
  item = createDraggableItem(controller, registerBindingCleanup);

  root.append(rootDropzone, targetDropzone);
  rootDropzone.append(item);

  return () => {
    controller.dispose();
    cleanupMovePreview();
    cleanupReleaseOverlay();
    runBindingCleanups();
    cancelPendingAnimationFrames();
    cancelPendingTimeouts();
    removeEventListeners();
    clearActiveDropzones();
    root.replaceChildren();
  };

  function registerBindingCleanup(cleanup: () => void): void {
    bindingCleanups.push(cleanup);
  }

  function runBindingCleanups(): void {
    for (const cleanup of bindingCleanups.splice(0).reverse()) {
      cleanup();
    }
  }

  function startMovePreview(dropTarget: string): void {
    const targetDropzone = dropzones.get(dropTarget);

    if (!targetDropzone) {
      return;
    }

    const resolvedTargetDropzone = targetDropzone;
    item.classList.add("sortableItemFadingOut");

    const preview = createDraggableItemPreview(finishMovePreview);
    resolvedTargetDropzone.append(preview.element);
    movePreviewCleanup = () => {
      preview.cleanup();
      preview.element.remove();
      item.classList.remove("sortableItemFadingOut");
      movePreviewCleanup = null;
    };

    function finishMovePreview(): void {
      preview.cleanup();
      preview.element.remove();
      item.classList.remove("sortableItemFadingOut");
      resolvedTargetDropzone.append(item);
      movePreviewCleanup = null;
    }
  }

  function cleanupMovePreview(): void {
    movePreviewCleanup?.();
  }

  function getItemContainerId(): string | null {
    for (const [targetId, dropzone] of dropzones) {
      if (item.parentElement === dropzone) {
        return targetId;
      }
    }

    return null;
  }

  function createDragOverlay({
    phase,
    finish,
  }: DragControllerOverlayInput): HTMLElement | null {
    if (phase === "released" && !overlayTargetRect) {
      cleanupReleaseOverlay();
      finish();
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className =
      phase === "released"
        ? "sortableOverlay basicDragOverlayReleasing"
        : "sortableOverlay";
    appendItemContents(overlay, false);

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
      overlayTargetRect = null;
      finish();
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
      overlayTargetRect = null;
      finish();
    };

    animationFrameId = scheduleAnimationFrame(() => {
      animationFrameId = null;

      if (!overlay.isConnected) {
        completeReleaseOverlay();
        return;
      }

      const overlayRect = overlay.getBoundingClientRect();
      const offset = {
        x: getRectCenterX(targetRect) - getRectCenterX(overlayRect),
        y: getRectCenterY(targetRect) - getRectCenterY(overlayRect),
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

  function createDraggableItemPreview(onFadeInEnd: () => void): {
    element: HTMLElement;
    cleanup: () => void;
  } {
    const preview = document.createElement("div");
    preview.className =
      "sortableItem sortableItemPreview sortableItemFadingIn";
    appendItemContents(preview, false);

    const handleAnimationEnd = (event: AnimationEvent): void => {
      if (
        event.target !== preview ||
        event.animationName !== "basicDragItemFadeIn"
      ) {
        return;
      }

      onFadeInEnd();
    };
    const cleanup = addManagedEventListener(
      preview,
      "animationend",
      handleAnimationEnd as EventListener,
    );

    return {
      element: preview,
      cleanup,
    };
  }

  function clearActiveDropzones(): void {
    root
      .querySelectorAll<HTMLElement>("[data-basic-drop-target-id]")
      .forEach((element) => {
        delete element.dataset.basicActiveDropTarget;
      });
  }

  function updateActiveDropzone(
    activeDropTarget: string | null,
    previousDropTarget: string | null,
  ): void {
    if (activeDropTarget === previousDropTarget) {
      return;
    }

    setDropzoneActive(previousDropTarget, false);
    setDropzoneActive(activeDropTarget, true);
  }

  function setDropzoneActive(targetId: string | null, active: boolean): void {
    if (!targetId) {
      return;
    }

    root
      .querySelectorAll<HTMLElement>("[data-basic-drop-target-id]")
      .forEach((element) => {
        if (element.dataset.basicDropTargetId !== targetId) {
          return;
        }

        if (active) {
          element.dataset.basicActiveDropTarget = "true";
        } else {
          delete element.dataset.basicActiveDropTarget;
        }
      });
  }

  function createDropzone(
    dragController: DragController,
    targetId: string,
    label: string,
    registerCleanup: (cleanup: () => void) => void,
  ): HTMLElement {
    const element = document.createElement("div");
    element.className = "droppableContainer";
    element.dataset.basicDropTargetId = targetId;

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    element.append(labelElement);

    registerCleanup(
      createDroppable({
        controller: dragController,
        element,
        targetId,
        group: basicGroup,
      }),
    );
    dropzones.set(targetId, element);

    return element;
  }
}

function createDraggableItem(
  controller: DragController,
  registerCleanup: (cleanup: () => void) => void,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "sortableItem";

  const handle = document.createElement("button");
  handle.className = "dragListHandle";
  handle.type = "button";
  handle.setAttribute("aria-label", "Drag item");
  handle.textContent = dragHandleText;
  appendItemLabel(element, handle);

  registerCleanup(
    createDraggable({
      controller,
      element,
      itemId: draggableItem.itemId,
      group: basicGroup,
    }),
  );
  registerCleanup(createDragHandle({ element: handle }));

  return element;
}

function appendItemContents(
  element: HTMLElement,
  interactiveHandle: boolean,
): void {
  const handle = interactiveHandle
    ? document.createElement("button")
    : document.createElement("div");
  handle.className = "dragListHandle";
  handle.textContent = dragHandleText;

  if (handle instanceof HTMLButtonElement) {
    handle.type = "button";
    handle.setAttribute("aria-label", "Drag item");
  }

  appendItemLabel(element, handle);
}

function appendItemLabel(element: HTMLElement, handle: HTMLElement): void {
  const label = document.createElement("span");
  label.textContent = draggableItem.label;

  element.append(handle, label);
}

function isKnownDropTarget(targetId: string): boolean {
  return (
    targetId === rootContainer.targetId ||
    targetId === droppableContainer.targetId
  );
}

function getRectCenterX(rect: Pick<DOMRect, "left" | "width">): number {
  return rect.left + rect.width / 2;
}

function getRectCenterY(rect: Pick<DOMRect, "top" | "height">): number {
  return rect.top + rect.height / 2;
}
