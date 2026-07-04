import type {
  KeyboardConfiguration,
  PointerConfiguration,
} from "../input/config.js";
import { rectToDragRect } from "../geometry/rects.js";
import type { DragModifierInput } from "../modifiers/types.js";
import { createDragRuntimeHandle } from "../runtime/drag-runtime-handle.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import type {
  DragEndEvent,
  DragLifecycleCallbacks,
  DragStartEvent,
  DragUpdateEvent,
  DropEvent,
} from "../runtime/lifecycle.js";
import type {
  DragOverlayHostUpdate,
  DragOverlayPhase,
  DragOverlayRenderState,
  DragState,
} from "../runtime/types.js";
import { pointerToCenter } from "../targeting/algorithms.js";
import type {
  TargetingAlgorithm,
  TargetingConstraint,
} from "../targeting/types.js";
import { setControllerRuntime } from "./controller-internals.js";

export type DragControllerAnnouncements = {
  onDragStart?: (event: DragStartEvent) => string | null;
  onDragUpdate?: (event: DragUpdateEvent) => string | null;
  onDragEnd?: (event: DragEndEvent) => string | null;
  onDrop?: (event: DropEvent) => string | null;
};

export type DragControllerOverlayInput = {
  dragState: DragState;
  phase: DragOverlayPhase;
  finish: () => void;
};

export type DragControllerOptions = {
  announcements?: DragControllerAnnouncements;
  dragOverlay?: (input: DragControllerOverlayInput) => HTMLElement | null;
  keyboardConfiguration?: KeyboardConfiguration;
  keepOverlayOnDrop?: boolean;
  modifiers?: readonly DragModifierInput[];
  overlayRoot?: HTMLElement;
  pointerConfiguration?: PointerConfiguration;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
} & DragLifecycleCallbacks;

export type DragController = {
  update: (options: DragControllerOptions) => void;
  cleanup: () => void;
  dispose: () => void;
  finishOverlay: () => void;
  remeasureDropTargets: (input?: RemeasureDropTargetsInput) => void;
};

export function createDragController(
  options: DragControllerOptions = {},
): DragController {
  let currentOptions = options;
  let overlayWrapper: HTMLElement | null = null;
  let overlayElement: HTMLElement | null = null;
  let overlayResizeObserver: ResizeObserver | null = null;
  let liveRegion: HTMLElement | null = null;
  let lastAnnouncement: string | null = null;
  let disposed = false;

  const runtime = createDragRuntimeHandle({
    updateOverlayHost,
    targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
    targetingConstraint: options.targetingConstraint,
    hasDragOverlay: hasDragOverlay(options),
    keepOverlayOnDrop: options.keepOverlayOnDrop ?? false,
  });

  configureRuntime(options);
  syncLiveRegion();

  const controller: DragController = {
    update: (nextOptions) => {
      if (disposed) {
        return;
      }

      currentOptions = nextOptions;
      configureRuntime(nextOptions);
      syncLiveRegion();

      if (!hasDragOverlay(nextOptions)) {
        removeOverlay();
      }
    },
    cleanup: () => {
      if (disposed) {
        return;
      }

      runtime.cleanup();
      removeOverlay();
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      runtime.dispose();
      removeOverlay();
      removeLiveRegion();
      disposed = true;
    },
    finishOverlay,
    remeasureDropTargets: (input) => {
      runtime.remeasureDropTargets(input);
    },
  };

  setControllerRuntime(controller, runtime);

  return controller;

  function configureRuntime(nextOptions: DragControllerOptions): void {
    runtime.configure({
      targetingAlgorithm: nextOptions.targetingAlgorithm ?? pointerToCenter,
      targetingConstraint: nextOptions.targetingConstraint,
      hasDragOverlay: hasDragOverlay(nextOptions),
      keepOverlayOnDrop: nextOptions.keepOverlayOnDrop ?? false,
      lifecycleCallbacks: createLifecycleCallbacks(nextOptions),
      keyboardConfiguration: nextOptions.keyboardConfiguration,
      modifiers: nextOptions.modifiers,
      pointerConfiguration: nextOptions.pointerConfiguration,
    });
  }

  function createLifecycleCallbacks(
    nextOptions: DragControllerOptions,
  ): DragLifecycleCallbacks {
    return {
      onDragStart: (event, helpers) => {
        nextOptions.onDragStart?.(event, helpers);
        announce(nextOptions.announcements?.onDragStart?.(event));
      },
      onDragUpdate: (event, helpers) => {
        nextOptions.onDragUpdate?.(event, helpers);

        if (event.activeDropTarget !== event.previousDropTarget) {
          announce(nextOptions.announcements?.onDragUpdate?.(event));
        }
      },
      onDragEnd: (event, helpers) => {
        nextOptions.onDragEnd?.(event, helpers);
        announce(nextOptions.announcements?.onDragEnd?.(event));
      },
      onDrop: (event, helpers) => {
        nextOptions.onDrop?.(event, helpers);
        announce(nextOptions.announcements?.onDrop?.(event));
      },
    };
  }

  function updateOverlayHost(update: DragOverlayHostUpdate): void {
    if (disposed) {
      removeOverlay();
      return;
    }

    if (update.type === "mount" || update.type === "release") {
      mountOverlay(update.state);
      return;
    }

    if (update.type === "move") {
      moveOverlay(update.dragState);
      return;
    }

    removeOverlay();
  }

  function mountOverlay(overlayState: DragOverlayRenderState): void {
    if (!currentOptions.dragOverlay) {
      removeOverlay();
      return;
    }

    const nextOverlayElement = currentOptions.dragOverlay({
      dragState: overlayState.dragState,
      phase: overlayState.phase,
      finish: finishOverlay,
    });

    if (!nextOverlayElement) {
      removeOverlay();
      return;
    }

    const wrapper = getOverlayWrapper(currentOptions.overlayRoot ?? document.body);
    styleOverlayWrapper(wrapper, overlayState.dragState);
    wrapper.replaceChildren(nextOverlayElement);
    setOverlayElement(nextOverlayElement);
  }

  function moveOverlay(dragState: DragState): void {
    if (!overlayWrapper) {
      return;
    }

    overlayWrapper.style.transform = getOverlayTransform(dragState);
  }

  function styleOverlayWrapper(
    wrapper: HTMLElement,
    dragState: DragState,
  ): void {
    wrapper.style.position = "fixed";
    wrapper.style.left = `${dragState.sourceRect.left}px`;
    wrapper.style.top = `${dragState.sourceRect.top}px`;
    wrapper.style.width = `${dragState.sourceRect.width}px`;
    wrapper.style.height = `${dragState.sourceRect.height}px`;
    wrapper.style.transform = getOverlayTransform(dragState);
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "9999";
  }

  function getOverlayTransform(dragState: DragState): string {
    const deltaX =
      dragState.pointerPosition.x - dragState.startPointerPosition.x;
    const deltaY =
      dragState.pointerPosition.y - dragState.startPointerPosition.y;

    return `translate3d(${deltaX}px, ${deltaY}px, 0)`;
  }

  function setOverlayElement(nextOverlayElement: HTMLElement): void {
    disconnectOverlayResizeObserver();
    overlayElement = nextOverlayElement;
    measureOverlayElement();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    overlayResizeObserver = new ResizeObserver(() => {
      measureOverlayElement();
    });
    overlayResizeObserver.observe(nextOverlayElement);
  }

  function measureOverlayElement(): void {
    if (!overlayElement?.isConnected) {
      return;
    }

    runtime.setOverlayRect(
      rectToDragRect(overlayElement.getBoundingClientRect()),
    );
  }

  function disconnectOverlayResizeObserver(): void {
    overlayResizeObserver?.disconnect();
    overlayResizeObserver = null;
  }

  function getOverlayWrapper(overlayRoot: HTMLElement): HTMLElement {
    if (!overlayWrapper) {
      overlayWrapper = document.createElement("div");
    }

    if (overlayWrapper.parentElement !== overlayRoot) {
      overlayRoot.append(overlayWrapper);
    }

    return overlayWrapper;
  }

  function finishOverlay(): void {
    if (disposed) {
      return;
    }

    removeOverlay();
  }

  function removeOverlay(): void {
    disconnectOverlayResizeObserver();
    overlayElement = null;
    runtime.setOverlayRect(null);
    overlayWrapper?.remove();
    overlayWrapper = null;
  }

  function syncLiveRegion(): void {
    if (currentOptions.announcements) {
      ensureLiveRegion();
      return;
    }

    removeLiveRegion();
  }

  function ensureLiveRegion(): HTMLElement {
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.style.position = "absolute";
      liveRegion.style.width = "1px";
      liveRegion.style.height = "1px";
      liveRegion.style.padding = "0";
      liveRegion.style.margin = "-1px";
      liveRegion.style.overflow = "hidden";
      liveRegion.style.clip = "rect(0 0 0 0)";
      liveRegion.style.whiteSpace = "nowrap";
      liveRegion.style.border = "0";
      document.body.append(liveRegion);
    }

    return liveRegion;
  }

  function announce(message: string | null | undefined): void {
    if (
      !message ||
      message === lastAnnouncement ||
      !currentOptions.announcements
    ) {
      return;
    }

    lastAnnouncement = message;
    ensureLiveRegion().textContent = message;
  }

  function removeLiveRegion(): void {
    lastAnnouncement = null;
    liveRegion?.remove();
    liveRegion = null;
  }
}

function hasDragOverlay(options: DragControllerOptions): boolean {
  return options.dragOverlay !== undefined;
}
