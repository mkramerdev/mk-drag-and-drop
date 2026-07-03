import type {
  KeyboardConfiguration,
  PointerConfiguration,
} from "../input/config.js";
import { rectToDragRect } from "../geometry/rects.js";
import type { DragModifierInput } from "../modifiers/types.js";
import {
  DragRuntime,
} from "../runtime/drag-runtime.js";
import type { RemeasureDropTargetsInput } from "../runtime/drop-target-registry.js";
import type {
  DragEndEvent,
  DragLifecycleCallbacks,
  DragStartEvent,
  DragUpdateEvent,
  DropEvent,
} from "../runtime/lifecycle.js";
import type {
  DragOverlayPhase,
  DragOverlayRenderState,
  DragState,
} from "../runtime/types.js";
import { pointerToCenter } from "../targeting/algorithms.js";
import type {
  TargetingAlgorithm,
  TargetingConstraint,
} from "../targeting/types.js";

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
  runtime: DragRuntime;
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
  let liveRegion: HTMLElement | null = null;
  let disposed = false;

  const runtime = new DragRuntime({
    setOverlayState: renderOverlay,
    targetingAlgorithm: options.targetingAlgorithm ?? pointerToCenter,
    targetingConstraint: options.targetingConstraint,
    hasDragOverlay: hasDragOverlay(options),
    keepOverlayOnDrop: options.keepOverlayOnDrop ?? false,
  });

  configureRuntime(options);
  syncLiveRegion();

  return {
    runtime,
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
        announce(nextOptions.announcements?.onDragUpdate?.(event));
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

  function renderOverlay(overlayState: DragOverlayRenderState | null): void {
    if (disposed || overlayState === null || !currentOptions.dragOverlay) {
      runtime.setOverlayRect(null);
      removeOverlay();
      return;
    }

    const overlayElement = currentOptions.dragOverlay({
      dragState: overlayState.dragState,
      phase: overlayState.phase,
      finish: finishOverlay,
    });

    if (!overlayElement) {
      runtime.setOverlayRect(null);
      removeOverlay();
      return;
    }

    const wrapper = getOverlayWrapper(currentOptions.overlayRoot ?? document.body);
    const { dragState } = overlayState;
    const deltaX =
      dragState.pointerPosition.x - dragState.startPointerPosition.x;
    const deltaY =
      dragState.pointerPosition.y - dragState.startPointerPosition.y;

    wrapper.style.position = "fixed";
    wrapper.style.left = `${dragState.sourceRect.left}px`;
    wrapper.style.top = `${dragState.sourceRect.top}px`;
    wrapper.style.width = `${dragState.sourceRect.width}px`;
    wrapper.style.height = `${dragState.sourceRect.height}px`;
    wrapper.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "9999";
    wrapper.replaceChildren(overlayElement);
    runtime.setOverlayRect(
      rectToDragRect(overlayElement.getBoundingClientRect()),
    );
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
    if (message === null || message === undefined || !currentOptions.announcements) {
      return;
    }

    ensureLiveRegion().textContent = message;
  }

  function removeLiveRegion(): void {
    liveRegion?.remove();
    liveRegion = null;
  }
}

function hasDragOverlay(options: DragControllerOptions): boolean {
  return options.dragOverlay !== undefined;
}
