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
  type DragModifierInput,
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
  type DropPlacement,
  type DropTargetRegistration,
  type DropTargetRegistrationKind,
  type RegisterDropTargetOptions,
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

type DragSession =
  | { status: "idle" }
  | {
      status: "dragging";
      input: ActiveDragInput;
      itemId: string;
      group: DragGroup;
      sourceRect: DragRect;
      sourceContainerId: string | null;
      startPointerPosition: Point;
      rawPointerPosition: Point;
      pointerPosition: Point;
      activeDropTarget: string | null;
    };

type DraggingSession = Extract<DragSession, { status: "dragging" }>;

export class DragRuntime {
  isDragging = false;
  draggedId: string | null = null;
  draggedGroup: DragGroup | null = null;
  pointerPosition: Point | null = null;
  activeDropTarget: string | null = null;

  private session: DragSession = { status: "idle" };
  private modifiers: readonly DragModifierInput[] = [];
  private activeDragModifiers: ActiveDragModifier[] = [];
  private cleanupWindowListeners: (() => void) | null = null;
  private cleanupTextSelectionSuppression: (() => void) | null = null;
  private queuedPointerPosition: Point | null = null;
  private pointerFrameId: number | null = null;
  private subscriptions = new Set<DragRuntimeSubscription>();
  private disposeCallbacks = new Set<() => void>();
  private lifecycleCallbacks: DragLifecycleCallbacks = {};
  private dropTargetRegistry = new DropTargetRegistry();
  private lastDropPlacementInput: {
    itemId: string;
    group: DragGroup;
    dropTarget: string | null;
    sourceContainerId: string | null;
  } | null = null;
  private lastDropPlacement: DropPlacement | null = null;
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
      if (!request.element.isConnected) {
        return;
      }

      this.startDragNow({
        itemId: request.itemId,
        group: request.group,
        inputType: "pointer",
        pointerId: request.pointerId,
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
        pointerId: activation.pointerId,
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
    getActiveInput: () => this.getActiveInput(),
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
    const session = this.getDraggingSession();

    if (!session || session.input !== "keyboard") {
      return;
    }

    const distance = this.keyboardConfiguration.moveDistance;
    const pointerPosition = {
      x: session.rawPointerPosition.x,
      y: session.rawPointerPosition.y,
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

    this.updatePointerNow(pointerPosition);
  }

  updatePointer(rawPointerPosition: Point): void {
    if (this.session.status !== "dragging") {
      return;
    }

    this.queuedPointerPosition = rawPointerPosition;

    if (this.pointerFrameId !== null) {
      return;
    }

    this.pointerFrameId = window.requestAnimationFrame(() => {
      this.pointerFrameId = null;
      const nextPointerPosition = this.queuedPointerPosition;
      this.queuedPointerPosition = null;

      if (nextPointerPosition) {
        this.updatePointerNow(nextPointerPosition);
      }
    });
  }

  private updatePointerNow(rawPointerPosition: Point): void {
    const session = this.getDraggingSession();

    if (!session) {
      return;
    }

    const previousDropTarget = session.activeDropTarget;
    const pointerPosition = applyDragModifiers({
      activeModifiers: this.activeDragModifiers,
      itemId: session.itemId,
      group: session.group,
      sourceRect: session.sourceRect,
      initialPointerPosition: session.startPointerPosition,
      rawPointerPosition,
    });

    const nextSession: DraggingSession = {
      ...session,
      rawPointerPosition,
      pointerPosition,
      activeDropTarget: this.getActiveDropTarget(pointerPosition),
    };
    this.setSession(nextSession);

    this.setOverlayState({
      dragState: this.createDragState(nextSession),
      phase: "dragging",
    });
    this.notifyDragUpdate({
      itemId: nextSession.itemId,
      pointerPosition,
      activeDropTarget: nextSession.activeDropTarget,
      previousDropTarget,
    });
  }

  endDrag(): void {
    this.flushQueuedPointerUpdate();
    this.finishDrag({
      dropTarget: this.getDraggingSession()?.activeDropTarget ?? null,
      keepReleasedOverlay: this.keepOverlayOnDrop,
    });
  }

  cancelDrag(): void {
    this.flushQueuedPointerUpdate();
    this.finishDrag({
      dropTarget: null,
      keepReleasedOverlay: false,
    });
  }

  registerDropTarget(
    id: string,
    element: HTMLElement,
    group: DragGroup,
    options?: RegisterDropTargetOptions,
  ): void {
    this.dropTargetRegistry.register(id, element, group, options);
  }

  unregisterDropTarget(id: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(
      id,
      element,
      "item",
    );

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  registerDropContainer(
    containerId: string,
    element: HTMLElement,
    group: DragGroup,
  ): void {
    this.dropTargetRegistry.register(containerId, element, group, {
      containerId,
      kind: "container",
    });
  }

  unregisterDropContainer(containerId: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(
      containerId,
      element,
      "container",
    );

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  cleanup(): void {
    this.pointerActivation.cancel();
    this.resetActiveDragState();
    this.cleanupActiveDragResources();
    this.setOverlayState(null);
  }

  getSortablePlacement(itemId: string): SortablePlacement | null {
    const placement = this.getDropPlacement(itemId);

    if (placement) {
      return {
        itemId: placement.itemId,
        previousItemId: placement.previousItemId,
        nextItemId: placement.nextItemId,
      };
    }

    return this.dropTargetRegistry.getSortablePlacement(itemId);
  }

  getDropPlacement(itemId?: string): DropPlacement | null {
    const session = this.getDraggingSession();

    if (
      !session &&
      this.lastDropPlacement &&
      (itemId === undefined || itemId === this.lastDropPlacement.itemId)
    ) {
      return this.lastDropPlacement;
    }

    const placementInput = session
      ? {
          itemId: itemId ?? session.itemId,
          group: session.group,
          dropTarget: session.activeDropTarget,
          sourceContainerId: session.sourceContainerId,
        }
      : this.lastDropPlacementInput
        ? {
            ...this.lastDropPlacementInput,
            itemId: itemId ?? this.lastDropPlacementInput.itemId,
          }
        : null;

    if (!placementInput) {
      return null;
    }

    return this.dropTargetRegistry.getDropPlacement({
      itemId: placementInput.itemId,
      dropTargetId: placementInput.dropTarget,
      group: placementInput.group,
      sourceContainerId: placementInput.sourceContainerId,
    });
  }

  getDropTargetRect(dropTargetId: string): DragRect | null {
    return this.dropTargetRegistry.getViewportRect(dropTargetId);
  }

  getDropTargetRegistration(
    dropTargetId: string,
    group?: DragGroup,
    kind?: DropTargetRegistrationKind,
  ): DropTargetRegistration | null {
    return this.dropTargetRegistry.getDropTargetRegistration(
      dropTargetId,
      group,
      kind,
    );
  }

  getCurrentDragRect(): DragRect | null {
    const session = this.getDraggingSession();

    return session
      ? this.getCurrentDragRectAt(session.pointerPosition)
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

  onDispose(callback: () => void): () => void {
    this.disposeCallbacks.add(callback);

    return () => {
      this.disposeCallbacks.delete(callback);
    };
  }

  dispose(): void {
    this.cleanup();

    for (const disposeCallback of Array.from(this.disposeCallbacks)) {
      disposeCallback();
    }

    this.disposeCallbacks.clear();
    this.subscriptions.clear();
    this.dropTargetRegistry.clear();
    this.lifecycleCallbacks = {};
    this.modifiers = [];
    this.setOverlayState = noopSetOverlayState;
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
    const sourceContainerId =
      this.dropTargetRegistry.getDropTargetRegistration(
        input.itemId,
        input.group,
        "item",
      )?.containerId ?? null;

    const nextSession: DraggingSession = {
      status: "dragging",
      input: input.inputType,
      itemId: input.itemId,
      group: input.group,
      sourceRect: input.sourceRect,
      sourceContainerId,
      startPointerPosition: rawPointerPosition,
      rawPointerPosition,
      pointerPosition: effectivePointerPosition,
      activeDropTarget: null,
    };

    this.lastDropPlacementInput = null;
    this.lastDropPlacement = null;
    this.setSession(nextSession);
    this.remeasureDropTargets();

    this.setOverlayState({
      dragState: this.createDragState(nextSession),
      phase: "dragging",
    });
    this.suppressTextSelection();
    if (input.inputType === "pointer") {
      this.bindPointerWindowListeners(input.pointerId);
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

    const session = this.getDraggingSession();
    const itemId = session?.itemId ?? null;
    this.lastDropPlacementInput = session
      ? {
          itemId: session.itemId,
          group: session.group,
          dropTarget: input.dropTarget,
          sourceContainerId: session.sourceContainerId,
        }
      : null;
    this.lastDropPlacement = this.lastDropPlacementInput
      ? this.dropTargetRegistry.getDropPlacement({
          itemId: this.lastDropPlacementInput.itemId,
          dropTargetId: this.lastDropPlacementInput.dropTarget,
          group: this.lastDropPlacementInput.group,
          sourceContainerId: this.lastDropPlacementInput.sourceContainerId,
        })
      : null;
    const releasedDragState = session
      ? this.createDragState(session)
      : null;

    this.resetActiveDragState();
    this.cleanupActiveDragResources();

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

  private bindPointerWindowListeners(pointerId: number): void {
    this.cleanupWindowListeners?.();

    const handlePointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      this.updatePointer({
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      this.endDrag();
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      this.cancelDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    this.cleanupWindowListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
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

  private resetActiveDragState(): void {
    this.cancelQueuedPointerUpdate();
    this.setSession({ status: "idle" });
    this.activeDragModifiers = [];
  }

  private cleanupActiveDragResources(): void {
    this.cleanupWindowListeners?.();
    this.cleanupWindowListeners = null;
    this.cleanupTextSelectionSuppression?.();
    this.cleanupTextSelectionSuppression = null;
  }

  private flushQueuedPointerUpdate(): void {
    if (this.pointerFrameId !== null) {
      window.cancelAnimationFrame(this.pointerFrameId);
      this.pointerFrameId = null;
    }

    const nextPointerPosition = this.queuedPointerPosition;
    this.queuedPointerPosition = null;

    if (nextPointerPosition) {
      this.updatePointerNow(nextPointerPosition);
    }
  }

  private cancelQueuedPointerUpdate(): void {
    if (this.pointerFrameId !== null) {
      window.cancelAnimationFrame(this.pointerFrameId);
      this.pointerFrameId = null;
    }

    this.queuedPointerPosition = null;
  }

  private setSession(session: DragSession): void {
    this.session = session;
    this.syncPublicDragFields();
  }

  private syncPublicDragFields(): void {
    if (this.session.status === "idle") {
      this.isDragging = false;
      this.draggedId = null;
      this.draggedGroup = null;
      this.pointerPosition = null;
      this.activeDropTarget = null;
      return;
    }

    this.isDragging = true;
    this.draggedId = this.session.itemId;
    this.draggedGroup = this.session.group;
    this.pointerPosition = this.session.pointerPosition;
    this.activeDropTarget = this.session.activeDropTarget;
  }

  private getActiveInput(): ActiveDragInput | null {
    return this.session.status === "dragging" ? this.session.input : null;
  }

  private getDraggingSession(): DraggingSession | null {
    return this.session.status === "dragging" ? this.session : null;
  }

  private createDragState(session: DraggingSession): DragState {
    return {
      itemId: session.itemId,
      sourceRect: session.sourceRect,
      startPointerPosition: session.startPointerPosition,
      pointerPosition: session.pointerPosition,
    };
  }

  private getActiveDropTarget(pointerPosition: Point): string | null {
    const session = this.getDraggingSession();

    if (!session) {
      return null;
    }

    const overlayRect = this.hasDragOverlay
      ? this.getCurrentDragRectAt(pointerPosition)
      : null;
    const activeTarget = this.targetingAlgorithm({
      pointerPosition,
      overlayRect,
      dropTargets: this.getAvailableDropTargets({
        group: session.group,
        pointerPosition,
        overlayRect,
      }),
    });

    return activeTarget?.dropTargetKey ?? null;
  }

  private getAvailableDropTargets(input: {
    group: DragGroup;
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): DropTarget[] {
    return this.dropTargetRegistry.getAvailableDropTargets({
      group: input.group,
      pointerPosition: input.pointerPosition,
      overlayRect: input.overlayRect,
      targetingConstraint: this.targetingConstraint,
    });
  }

  private getCurrentDragRectAt(pointerPosition: Point): DragRect | null {
    const session = this.getDraggingSession();

    if (!session) {
      return null;
    }

    return getOverlayRect({
      sourceRect: session.sourceRect,
      initialPointerPosition: session.startPointerPosition,
      pointerPosition,
    });
  }

  private createLifecycleHelpers(): DragLifecycleHelpers {
    return {
      getDropPlacement: (itemId) => this.getDropPlacement(itemId),
      getSortablePlacement: (itemId) => this.getSortablePlacement(itemId),
      getDropTargetRect: (dropTargetId) =>
        this.getDropTargetRect(dropTargetId),
    };
  }

  private clearActiveDropTargetIfRemoved(
    removedTargets: DropTargetRegistration[],
  ): void {
    if (this.session.status !== "dragging") {
      return;
    }

    const session = this.session;
    const removedActiveTarget = removedTargets.some(
      (removedTarget) =>
        removedTarget.id === session.activeDropTarget &&
        removedTarget.group === session.group,
    );

    if (!removedActiveTarget) {
      return;
    }

    this.setSession({
      ...session,
      activeDropTarget: null,
    });
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
