import type { DragRect } from "../geometry/rects.js";
import { measureDomElement } from "../geometry/measurement.js";
import { getOverlayRect } from "../geometry/overlay.js";
import {
  defaultKeyboardConfiguration,
  normalizeKeyboardConfiguration,
  normalizePointerConfiguration,
  type NormalizedKeyboardConfiguration,
  type NormalizedPointerConfiguration,
} from "../input/config.js";
import {
  KeyboardDragController,
  type KeyboardMoveDirection,
  type SourceKeyboardDragKeyDownInput as KeyboardSourceKeyDownInput,
} from "../input/keyboard-drag.js";
import { PointerActivationController } from "../input/pointer-activation.js";
import {
  applyDragModifiers,
  createActiveDragModifiers,
} from "../modifiers/pipeline.js";
import {
  type ActiveDragModifier,
  type DragModifier,
} from "../modifiers/types.js";
import {
  pointerToCenter,
  type DropTarget,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "../targeting/index.js";
import {
  DropTargetRegistry,
  type DragGroup,
  type RemeasureDropTargetsInput,
  type SortablePlacement,
} from "./drop-target-registry.js";
import type {
  DragEndEvent,
  DragLifecycleCallbacks,
  DragLifecycleHelpers,
  DragRuntimeSubscription,
  DragStartEvent,
  DragUpdateEvent,
  DropEvent,
} from "./lifecycle.js";
import type {
  ActiveDragInput,
  DragOverlayRenderState,
  DragRuntimeConfigureInput,
  DragRuntimeOptions,
  DragState,
  Point,
  RequestDragStartInput,
  RequestKeyboardDragStartInput,
  StartDragInput,
} from "./types.js";

const noopSetOverlayState = (): void => {};

export class DragRuntime {
  isDragging = false;
  draggedId: string | null = null;
  draggedGroup: DragGroup | null = null;
  pointerPosition: Point | null = null;
  activeDropTarget: string | null = null;

  private dragState: DragState | null = null;
  private activeDragInput: ActiveDragInput | null = null;
  private rawPointerPosition: Point | null = null;
  private modifiers: readonly DragModifier<any>[] = [];
  private activeDragModifiers: ActiveDragModifier[] = [];
  private cleanupWindowListeners: (() => void) | null = null;
  private cleanupTextSelectionSuppression: (() => void) | null = null;
  private subscriptions = new Set<DragRuntimeSubscription>();
  private lifecycleCallbacks: DragLifecycleCallbacks = {};
  private dropTargetRegistry = new DropTargetRegistry();
  private pointerConfiguration: NormalizedPointerConfiguration = {
    activationDelay: null,
    activationDistance: null,
  };
  private keyboardConfiguration: NormalizedKeyboardConfiguration =
    defaultKeyboardConfiguration;
  private setOverlayState: (
    overlayState: DragOverlayRenderState | null,
  ) => void;
  private targetingAlgorithm: TargetingAlgorithm;
  private hasDragOverlay: boolean;
  private keepOverlayOnDrop: boolean;
  private targetingConstraint: TargetingConstraint | undefined;
  private pointerActivation = new PointerActivationController({
    getConfiguration: () => this.pointerConfiguration,
    isDragging: () => this.isDragging,
    startImmediately: (request) => {
      this.startDragNow({
        itemId: request.itemId,
        group: request.group,
        inputType: "pointer",
        pointerPosition: request.pointerPosition,
        sourceRect: measureDomElement(request.element),
      });
    },
    activate: (activation) => {
      if (this.isDragging || !activation.element.isConnected) {
        return;
      }

      this.startDragNow({
        itemId: activation.itemId,
        group: activation.group,
        inputType: "pointer",
        pointerPosition: activation.initialPointerPosition,
        sourceRect: measureDomElement(activation.element),
      });

      if (
        activation.latestPointerPosition.x !==
          activation.initialPointerPosition.x ||
        activation.latestPointerPosition.y !==
          activation.initialPointerPosition.y
      ) {
        this.updatePointer(activation.latestPointerPosition);
      }
    },
  });
  private keyboardDrag = new KeyboardDragController({
    getConfiguration: () => this.keyboardConfiguration,
    isDragging: () => this.isDragging,
    getActiveInput: () => this.activeDragInput,
    start: (input) => {
      this.requestKeyboardDragStart(input);
    },
    move: (direction) => {
      this.moveKeyboardDrag(direction);
    },
    drop: () => {
      this.endDrag();
    },
    cancel: () => {
      this.cancelDrag();
    },
  });

  constructor(options: DragRuntimeOptions = {}) {
    this.setOverlayState = options.setOverlayState ?? noopSetOverlayState;
    this.targetingAlgorithm = options.targetingAlgorithm ?? pointerToCenter;
    this.hasDragOverlay = options.hasDragOverlay ?? false;
    this.keepOverlayOnDrop = options.keepOverlayOnDrop ?? false;
    this.targetingConstraint = options.targetingConstraint;
  }

  configure(input: DragRuntimeConfigureInput): void {
    this.hasDragOverlay = input.hasDragOverlay;
    this.keepOverlayOnDrop = input.keepOverlayOnDrop;
    this.targetingAlgorithm = input.targetingAlgorithm;
    this.targetingConstraint = input.targetingConstraint;
    this.lifecycleCallbacks = input.lifecycleCallbacks;
    this.keyboardConfiguration = normalizeKeyboardConfiguration(
      input.keyboardConfiguration,
    );
    this.modifiers = input.modifiers ? Array.from(input.modifiers) : [];
    this.pointerConfiguration = normalizePointerConfiguration(
      input.pointerConfiguration,
    );
  }

  requestDragStart(input: RequestDragStartInput): void {
    this.pointerActivation.request(input);
  }

  isKeyboardDragEnabled(): boolean {
    return this.keyboardDrag.isEnabled();
  }

  handleSourceKeyboardKeyDown(input: KeyboardSourceKeyDownInput): boolean {
    return this.keyboardDrag.handleSourceKeyDown(input);
  }

  requestKeyboardDragStart(input: RequestKeyboardDragStartInput): void {
    this.pointerActivation.cancel();

    if (
      this.isDragging ||
      !this.keyboardDrag.isEnabled() ||
      !input.element.isConnected
    ) {
      return;
    }

    const sourceRect = measureDomElement(input.element);
    const pointerPosition = {
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
    };

    this.startDragNow({
      itemId: input.itemId,
      group: input.group,
      inputType: "keyboard",
      pointerPosition,
      sourceRect,
    });
  }

  moveKeyboardDrag(direction: KeyboardMoveDirection): void {
    if (
      !this.isDragging ||
      this.activeDragInput !== "keyboard" ||
      !this.rawPointerPosition
    ) {
      return;
    }

    const distance = this.keyboardConfiguration.moveDistance;
    const pointerPosition = {
      x: this.rawPointerPosition.x,
      y: this.rawPointerPosition.y,
    };

    if (direction === "up") {
      pointerPosition.y -= distance;
    } else if (direction === "down") {
      pointerPosition.y += distance;
    } else if (direction === "left") {
      pointerPosition.x -= distance;
    } else {
      pointerPosition.x += distance;
    }

    this.updatePointer(pointerPosition);
  }

  updatePointer(rawPointerPosition: Point): void {
    if (!this.isDragging || !this.dragState) {
      return;
    }

    const itemId = this.dragState.itemId;
    const group = this.draggedGroup;
    const previousDropTarget = this.activeDropTarget;

    if (group === null) {
      return;
    }

    const pointerPosition = applyDragModifiers({
      activeModifiers: this.activeDragModifiers,
      itemId,
      group,
      sourceRect: this.dragState.sourceRect,
      initialPointerPosition: this.dragState.startPointerPosition,
      rawPointerPosition,
    });

    this.rawPointerPosition = rawPointerPosition;
    this.pointerPosition = pointerPosition;
    this.activeDropTarget = this.getActiveDropTarget(pointerPosition);
    this.dragState = {
      ...this.dragState,
      pointerPosition,
    };

    this.setOverlayState({
      dragState: this.dragState,
      phase: "dragging",
    });
    this.notifyDragUpdate({
      itemId,
      pointerPosition,
      activeDropTarget: this.activeDropTarget,
      previousDropTarget,
    });
  }

  endDrag(): void {
    this.finishDrag({
      dropTarget: this.activeDropTarget,
      keepReleasedOverlay: this.keepOverlayOnDrop,
    });
  }

  cancelDrag(): void {
    this.finishDrag({
      dropTarget: null,
      keepReleasedOverlay: false,
    });
  }

  registerDropTarget(
    id: string,
    element: HTMLElement,
    group: DragGroup,
  ): void {
    this.dropTargetRegistry.register(id, element, group);
  }

  unregisterDropTarget(id: string): void {
    this.dropTargetRegistry.unregister(id);
  }

  getSortablePlacement(itemId: string): SortablePlacement | null {
    return this.dropTargetRegistry.getSortablePlacement(itemId);
  }

  getDropTargetRect(dropTargetId: string): DragRect | null {
    return this.dropTargetRegistry.getViewportRect(dropTargetId);
  }

  getCurrentDragRect(): DragRect | null {
    return this.pointerPosition
      ? this.getCurrentDragRectAt(this.pointerPosition)
      : null;
  }

  remeasureDropTargets(input?: RemeasureDropTargetsInput): void {
    this.dropTargetRegistry.remeasure(input);
  }

  subscribe(subscription: DragRuntimeSubscription): () => void {
    this.subscriptions.add(subscription);

    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  private startDragNow(input: StartDragInput): void {
    if (this.targetingAlgorithm.mode === "rect" && !this.hasDragOverlay) {
      throw new Error(
        "The selected targeting algorithm requires a drag overlay. Provide dragOverlay or use a pointer-based targeting algorithm.",
      );
    }

    const rawPointerPosition = input.pointerPosition;
    const activeDragModifiers = createActiveDragModifiers({
      modifiers: this.modifiers,
      setupInput: {
        itemId: input.itemId,
        group: input.group,
        sourceRect: input.sourceRect,
        initialPointerPosition: rawPointerPosition,
      },
    });
    this.activeDragModifiers = activeDragModifiers;
    const effectivePointerPosition = applyDragModifiers({
      activeModifiers: activeDragModifiers,
      itemId: input.itemId,
      group: input.group,
      sourceRect: input.sourceRect,
      initialPointerPosition: rawPointerPosition,
      rawPointerPosition,
    });

    this.isDragging = true;
    this.activeDragInput = input.inputType;
    this.draggedId = input.itemId;
    this.draggedGroup = input.group;
    this.rawPointerPosition = rawPointerPosition;
    this.pointerPosition = effectivePointerPosition;
    this.activeDropTarget = null;
    this.remeasureDropTargets();

    this.dragState = {
      itemId: input.itemId,
      sourceRect: input.sourceRect,
      startPointerPosition: rawPointerPosition,
      pointerPosition: effectivePointerPosition,
    };

    this.setOverlayState({
      dragState: this.dragState,
      phase: "dragging",
    });
    this.suppressTextSelection();
    if (input.inputType === "pointer") {
      this.bindPointerWindowListeners();
    } else {
      this.bindKeyboardWindowListeners();
    }
    this.notifyDragStart({
      itemId: input.itemId,
      pointerPosition: effectivePointerPosition,
      sourceRect: input.sourceRect,
    });
  }

  private finishDrag(input: {
    dropTarget: string | null;
    keepReleasedOverlay: boolean;
  }): void {
    this.pointerActivation.cancel();

    const itemId = this.draggedId;
    const releasedDragState = this.dragState;

    this.isDragging = false;
    this.activeDragInput = null;
    this.draggedId = null;
    this.draggedGroup = null;
    this.rawPointerPosition = null;
    this.pointerPosition = null;
    this.activeDropTarget = null;
    this.dragState = null;
    this.activeDragModifiers = [];

    this.cleanupWindowListeners?.();
    this.cleanupWindowListeners = null;
    this.cleanupTextSelectionSuppression?.();
    this.cleanupTextSelectionSuppression = null;

    if (itemId) {
      this.notifyDragEnd({
        itemId,
        dropTarget: input.dropTarget,
      });

      if (input.dropTarget) {
        this.notifyDrop({
          itemId,
          dropTarget: input.dropTarget,
        });
      }
    }

    if (input.keepReleasedOverlay && releasedDragState && this.hasDragOverlay) {
      this.setOverlayState({
        dragState: releasedDragState,
        phase: "released",
      });
    } else {
      this.setOverlayState(null);
    }
  }

  private bindPointerWindowListeners(): void {
    this.cleanupWindowListeners?.();

    const handlePointerMove = (event: PointerEvent): void => {
      this.updatePointer({
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerEnd = (): void => {
      this.endDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    this.cleanupWindowListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }

  private bindKeyboardWindowListeners(): void {
    this.cleanupWindowListeners?.();
    this.cleanupWindowListeners = this.keyboardDrag.bindWindowListeners();
  }

  private suppressTextSelection(): void {
    this.cleanupTextSelectionSuppression?.();

    const root = document.documentElement;
    const body = document.body;
    const previousRootUserSelect = root.style.userSelect;
    const previousBodyUserSelect = body.style.userSelect;

    root.style.userSelect = "none";
    body.style.userSelect = "none";

    this.cleanupTextSelectionSuppression = () => {
      root.style.userSelect = previousRootUserSelect;
      body.style.userSelect = previousBodyUserSelect;
    };
  }

  private getActiveDropTarget(pointerPosition: Point): string | null {
    const overlayRect = this.hasDragOverlay
      ? this.getCurrentDragRectAt(pointerPosition)
      : null;
    const activeTarget = this.targetingAlgorithm({
      pointerPosition,
      overlayRect,
      dropTargets: this.getAvailableDropTargets({
        pointerPosition,
        overlayRect,
      }),
    });

    return activeTarget?.dropTargetKey ?? null;
  }

  private getAvailableDropTargets(input: {
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): DropTarget[] {
    return this.dropTargetRegistry.getAvailableDropTargets({
      group: this.draggedGroup,
      pointerPosition: input.pointerPosition,
      overlayRect: input.overlayRect,
      targetingConstraint: this.targetingConstraint,
    });
  }

  private getCurrentDragRectAt(pointerPosition: Point): DragRect | null {
    if (!this.dragState) {
      return null;
    }

    return getOverlayRect({
      sourceRect: this.dragState.sourceRect,
      initialPointerPosition: this.dragState.startPointerPosition,
      pointerPosition,
    });
  }

  private createLifecycleHelpers(): DragLifecycleHelpers {
    return {
      getSortablePlacement: (itemId) => this.getSortablePlacement(itemId),
      getDropTargetRect: (dropTargetId) =>
        this.getDropTargetRect(dropTargetId),
    };
  }

  private notifyDragStart(event: DragStartEvent): void {
    this.lifecycleCallbacks.onDragStart?.(
      event,
      this.createLifecycleHelpers(),
    );

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragStart?.(event);
    }
  }

  private notifyDragUpdate(event: DragUpdateEvent): void {
    this.lifecycleCallbacks.onDragUpdate?.(
      event,
      this.createLifecycleHelpers(),
    );

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragUpdate?.(event);
    }
  }

  private notifyDragEnd(event: DragEndEvent): void {
    this.lifecycleCallbacks.onDragEnd?.(
      event,
      this.createLifecycleHelpers(),
    );

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragEnd?.(event);
    }
  }

  private notifyDrop(event: DropEvent): void {
    this.lifecycleCallbacks.onDrop?.(event, this.createLifecycleHelpers());

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDrop?.(event);
    }
  }
}

export function createDragRuntime(
  options?: DragRuntimeOptions,
): DragRuntime {
  return new DragRuntime(options);
}
