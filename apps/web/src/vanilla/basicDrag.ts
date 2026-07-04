import {
  createDragController,
  createDraggable,
  createDroppable,
  createDragHandle,
  maxDistanceToRect,
  pointerToRectDistance,
  restrictToContainer,
  type DragController,
  type DragControllerOverlayInput,
  type DragRect,
} from "@mk-drag-and-drop/dom";

const draggableItem = {
  draggableId: "draggable",
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
const dragHandleText = "\u22ee\u22ee";

// Example state: preview and release animation state are owned by this demo.
type MovePreviewState = {
  element: HTMLElement;
  cleanup: () => void;
};

type ReleaseOverlayState = {
  animationFrameId: number | null;
  animations: Animation[];
  active: boolean;
};

export function mountBasicDrag(root: HTMLElement): () => void {
  const pendingAnimationFrames = new Set<number>();
  // Example state: the app owns transient preview and overlay geometry.
  let overlayTargetRect: DragRect | null = null;
  let releaseOverlayState: ReleaseOverlayState | null = null;
  let movePreviewState: MovePreviewState | null = null;

  // Package API: creates the drag controller used by this vanilla example.
  const controller = createDragController({
    targetingAlgorithm: pointerToRectDistance,
    targetingConstraint: maxDistanceToRect({ maxDistance: 96 }),
    modifiers: [
      restrictToContainer(({ group }) => (group === basicGroup ? root : null)),
    ],
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
    onDrop({ draggableId: droppedItemId, dropTarget }, { getDropTargetRect }) {
      // Example drop behavior: commit valid drops into app-owned DOM state.
      if (
        droppedItemId !== "draggable" ||
        !isKnownDropTarget(dropTarget)
      ) {
        return;
      }

      const itemElement = root.querySelector<HTMLElement>(
        '[data-basic-item-id="draggable"]',
      );

      if (!itemElement) {
        return;
      }

      const isSameContainer =
        (dropTarget === rootContainer.targetId &&
          itemElement.parentElement === rootDropzoneElement) ||
        (dropTarget === droppableContainer.targetId &&
          itemElement.parentElement === targetDropzoneElement);

      if (isSameContainer || movePreviewState) {
        return;
      }

      overlayTargetRect = getDropTargetRect(dropTarget);
      startMovePreview(dropTarget);
    },
  });

  const rootDropzoneElement = createDropzone(
    controller,
    rootContainer.targetId,
    rootContainer.label,
  );
  const targetDropzoneElement = createDropzone(
    controller,
    droppableContainer.targetId,
    droppableContainer.label,
  );
  const itemElement = createDraggableItem(controller, "draggable");

  root.append(rootDropzoneElement, targetDropzoneElement);
  rootDropzoneElement.append(itemElement);

  return () => {
    controller.dispose();
    cleanupMovePreview();
    cleanupReleaseOverlay();
    cancelPendingAnimationFrames();
    clearActiveDropzones();
    root.replaceChildren();
  };

  // Example drop behavior: create a demo-owned move preview before final DOM commit.
  function startMovePreview(dropTarget: string): void {
    const itemElement = root.querySelector<HTMLElement>(
      '[data-basic-item-id="draggable"]',
    );

    if (!itemElement) {
      return;
    }

    const targetDropzoneElementForDrop =
      dropTarget === rootContainer.targetId
        ? rootDropzoneElement
        : dropTarget === droppableContainer.targetId
          ? targetDropzoneElement
          : null;

    if (!targetDropzoneElementForDrop) {
      return;
    }

    const resolvedTargetDropzoneElement = targetDropzoneElementForDrop;
    itemElement.classList.add("sortableItemFadingOut");

    const preview = createDraggableItemPreview(finishMovePreview);
    resolvedTargetDropzoneElement.append(preview.element);
    movePreviewState = {
      element: preview.element,
      cleanup: preview.cleanup,
    };

    function finishMovePreview(): void {
      finishMovePreviewToDropzone(resolvedTargetDropzoneElement);
    }
  }

  function cleanupMovePreview(): void {
    const state = movePreviewState;

    if (!state) {
      return;
    }

    state.cleanup();
    state.element.remove();
    root
      .querySelector<HTMLElement>('[data-basic-item-id="draggable"]')
      ?.classList.remove("sortableItemFadingOut");
    movePreviewState = null;
  }

  // Example drop behavior: finish the app-owned preview and move the real DOM item.
  function finishMovePreviewToDropzone(targetDropzone: HTMLElement): void {
    const state = movePreviewState;

    if (!state) {
      return;
    }

    state.cleanup();
    state.element.remove();
    const itemElement = root.querySelector<HTMLElement>(
      '[data-basic-item-id="draggable"]',
    );

    if (!itemElement) {
      movePreviewState = null;
      return;
    }

    itemElement.classList.remove("sortableItemFadingOut");
    targetDropzone.append(itemElement);
    movePreviewState = null;
  }

  // Example rendering: overlay markup and release animation are app-owned.
  function createDragOverlay({
    dragState,
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
    appendItemContents(overlay, dragState.draggableId, false);

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
    const releaseState: ReleaseOverlayState = {
      animationFrameId: null,
      animations: [],
      active: true,
    };
    releaseOverlayState = releaseState;

    const completeReleaseOverlay = (): void => {
      if (completed || !releaseState.active) {
        return;
      }

      completed = true;
      cleanupReleaseOverlay();
      overlayTargetRect = null;
      finish();
    };

    releaseState.animationFrameId = scheduleAnimationFrame(() => {
      releaseState.animationFrameId = null;

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

      overlay.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      releaseState.animations = overlay.getAnimations();

      if (releaseState.animations.length === 0) {
        completeReleaseOverlay();
        return;
      }

      void Promise.all(
        releaseState.animations.map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      ).then(() => {
        if (releaseState.active) {
          completeReleaseOverlay();
        }
      });
    });
  }

  function cleanupReleaseOverlay(): void {
    const state = releaseOverlayState;

    if (!state) {
      return;
    }

    state.active = false;

    if (state.animationFrameId !== null) {
      cancelAnimationFrameId(state.animationFrameId);
      state.animationFrameId = null;
    }

    for (const animation of state.animations) {
      animation.cancel();
    }

    state.animations = [];
    releaseOverlayState = null;
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

  // Example rendering: transient preview markup is owned by the demo.
  function createDraggableItemPreview(onFadeInEnd: () => void): {
    element: HTMLElement;
    cleanup: () => void;
  } {
    const preview = document.createElement("div");
    preview.className =
      "sortableItem sortableItemPreview sortableItemFadingIn";
    appendItemContents(preview, draggableItem.draggableId, false);

    const handleAnimationEnd = (event: AnimationEvent): void => {
      if (
        event.target !== preview ||
        event.animationName !== "basicDragItemFadeIn"
      ) {
        return;
      }

      onFadeInEnd();
    };
    preview.addEventListener("animationend", handleAnimationEnd);

    return {
      element: preview,
      cleanup: () => {
        preview.removeEventListener("animationend", handleAnimationEnd);
      },
    };
  }

  // Example styling: active target attributes drive demo CSS highlights.
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
  ): HTMLElement {
    // Example rendering: dropzone markup is app-owned.
    const element = document.createElement("div");
    element.className = "droppableContainer";
    element.dataset.basicDropTargetId = targetId;

    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    element.append(labelElement);

    // Package API: registers this DOM node as a drop target.
    createDroppable({
      controller: dragController,
      element,
      targetId,
      group: basicGroup,
    });

    return element;
  }
}

// Example rendering: item markup is app-owned; package helpers wire it to dragging.
function createDraggableItem(
  controller: DragController,
  draggableId: string,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "sortableItem";
  element.dataset.basicItemId = draggableId;

  const handle = document.createElement("button");
  handle.className = "dragListHandle";
  handle.type = "button";
  handle.setAttribute("aria-label", "Drag item");
  handle.textContent = dragHandleText;
  appendItemLabel(element, handle, draggableId);

  // Package API: registers this DOM node and handle as draggable.
  createDraggable({
    controller,
    element,
    draggableId,
    group: basicGroup,
  });
  createDragHandle({ element: handle });

  return element;
}

function appendItemContents(
  element: HTMLElement,
  draggableId: string,
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

  appendItemLabel(element, handle, draggableId);
}

function appendItemLabel(
  element: HTMLElement,
  handle: HTMLElement,
  draggableId: string,
): void {
  const label = document.createElement("span");
  label.textContent = getDraggableItemLabel(draggableId);

  element.append(handle, label);
}

function getDraggableItemLabel(draggableId: string): string {
  return draggableId === draggableItem.draggableId ? draggableItem.label : "";
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
