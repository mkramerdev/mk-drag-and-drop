import type { DragRect } from "../geometry/rects.js";
import { measureDomElement } from "../geometry/measurement.js";
import {
  getOverlayMeasurement,
  getOverlayRect,
  type DragOverlayMeasurement,
} from "../geometry/overlay.js";
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
import { pointerToCenter } from "../targeting/algorithms.js";
import type {
  DropTarget,
  TargetingAlgorithm,
  TargetingConstraint,
} from "../targeting/types.js";
import {
  DropTargetRegistry,
  type DragGroup,
  type DropPlacement,
  type RegisterDropTargetOptions,
  type RemeasureDropTargetsInput,
  type RemovedDropTarget,
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
  DragOverlayHostUpdate,
  DragRuntimeConfigureInput,
  DragRuntimeOptions,
  DragState,
  Point,
  RequestDragStartInput,
  RequestKeyboardDragStartInput,
  StartDragInput,
} from "./types.js";

const noopUpdateOverlayHost = (): void => {};

type DragSession =
  | { status: "idle" }
  | {
      status: "dragging";
      input: ActiveDragInput;
      draggableId: string;
      group: DragGroup;
      sourceRect: DragRect;
      sourceContainerId: string | null;
      sourceSortablePlacement: SortablePlacement | null;
      overlayMeasurement: DragOverlayMeasurement | null;
      startPointerPosition: Point;
      rawPointerPosition: Point;
      pointerPosition: Point;
      activeDropTarget: string | null;
    };

type DraggingSession = Extract<DragSession, { status: "dragging" }>;

type DragUpdateSubscriptionEvent = DragUpdateEvent & {
  placementPosition: Point;
};

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
  private lifecycleHelpers: DragLifecycleHelpers = {
    getDropPlacement: (draggableId) => this.getDropPlacement(draggableId),
    getSortablePlacement: (draggableId) =>
      this.getSortablePlacement(draggableId),
    getDropTargetRect: (dropTargetId) => this.getDropTargetRect(dropTargetId),
  };
  private dropTargetRegistry = new DropTargetRegistry();
  private lastDropPlacementInput: {
    draggableId: string;
    group: DragGroup;
    dropTarget: string | null;
    sourceContainerId: string | null;
    sourceSortablePlacement: SortablePlacement | null;
  } | null = null;
  private lastDropPlacement: DropPlacement | null = null;
  private pointerConfiguration: NormalizedPointerConfiguration = {
    activationDelay: null,
    activationDistance: null,
  };
  private keyboardConfiguration: NormalizedKeyboardConfiguration =
    defaultKeyboardConfiguration;
  private updateOverlayHost: (update: DragOverlayHostUpdate) => void;
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
        draggableId: request.draggableId,
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
        draggableId: activation.draggableId,
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
    this.updateOverlayHost = options.updateOverlayHost ?? noopUpdateOverlayHost;
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
      draggableId: input.draggableId,
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
      draggableId: session.draggableId,
      group: session.group,
      sourceRect: session.sourceRect,
      initialPointerPosition: session.startPointerPosition,
      rawPointerPosition,
      overlayMeasurement: session.overlayMeasurement,
    });

    const overlayRect = this.hasDragOverlay
      ? this.getCurrentDragRectAt(pointerPosition)
      : null;
    const activeDropTarget = this.getActiveDropTarget({
      pointerPosition,
      overlayRect,
    });
    const placementPosition = this.getSortablePlacementPosition({
      pointerPosition,
      overlayRect,
    });
    const nextSession: DraggingSession = {
      ...session,
      rawPointerPosition,
      pointerPosition,
      activeDropTarget,
    };
    this.setSession(nextSession);

    this.updateOverlayHost({
      type: "move",
      dragState: this.createDragState(nextSession),
    });
    const updateEvent: DragUpdateEvent = {
      draggableId: nextSession.draggableId,
      pointerPosition,
      activeDropTarget: nextSession.activeDropTarget,
      previousDropTarget,
    };

    this.notifyDragUpdate(updateEvent, {
      ...updateEvent,
      placementPosition,
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
    const removedTargets = this.dropTargetRegistry.register(
      id,
      element,
      group,
      options,
    );

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  unregisterDropTarget(id: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(id, element);

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  registerDropContainer(
    containerId: string,
    element: HTMLElement,
    group: DragGroup,
  ): void {
    const removedTargets = this.dropTargetRegistry.register(
      containerId,
      element,
      group,
      {
        containerId,
        container: true,
      },
    );

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  unregisterDropContainer(containerId: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(containerId, element);

    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  cleanup(): void {
    this.pointerActivation.cancel();
    this.resetActiveDragState();
    this.cleanupActiveDragResources();
    this.updateOverlayHost({ type: "unmount" });
  }

  getSortablePlacement(draggableId: string): SortablePlacement | null {
    const placement = this.getDropPlacement(draggableId);

    if (placement) {
      if (!hasRelativeSortablePlacement(placement)) {
        return null;
      }

      const sortablePlacement = {
        draggableId: placement.draggableId,
        previousDraggableId: placement.previousDraggableId,
        nextDraggableId: placement.nextDraggableId,
      };

      if (isSameSortablePlacement(sortablePlacement, this.getSourceSortablePlacement())) {
        return null;
      }

      return sortablePlacement;
    }

    return this.dropTargetRegistry.getSortablePlacement(draggableId);
  }

  getDropPlacement(draggableId?: string): DropPlacement | null {
    const session = this.getDraggingSession();

    if (
      !session &&
      this.lastDropPlacement &&
      (draggableId === undefined || draggableId === this.lastDropPlacement.draggableId)
    ) {
      return this.lastDropPlacement;
    }

    const placementInput = session
      ? {
          draggableId: draggableId ?? session.draggableId,
          group: session.group,
          dropTarget: session.activeDropTarget,
          sourceContainerId: session.sourceContainerId,
        }
      : this.lastDropPlacementInput
        ? {
            ...this.lastDropPlacementInput,
            draggableId: draggableId ?? this.lastDropPlacementInput.draggableId,
          }
        : null;

    if (!placementInput) {
      return null;
    }

    return this.dropTargetRegistry.getDropPlacement({
      draggableId: placementInput.draggableId,
      dropTargetId: placementInput.dropTarget,
      group: placementInput.group,
      sourceContainerId: placementInput.sourceContainerId,
    });
  }

  getDropTargetRect(dropTargetId: string): DragRect | null {
    return this.dropTargetRegistry.getViewportRect(dropTargetId);
  }

  getDropTargetRegistration(dropTargetId: string, group?: DragGroup) {
    return this.dropTargetRegistry.getDropTargetRegistration(dropTargetId, group);
  }

  getCurrentDragRect(): DragRect | null {
    const session = this.getDraggingSession();

    return session
      ? this.getCurrentDragRectAt(session.pointerPosition)
      : null;
  }

  setOverlayRect(overlayRect: DragRect | null): void {
    const session = this.getDraggingSession();

    if (!session) {
      return;
    }

    const overlayMeasurement = overlayRect
      ? getOverlayMeasurement({
          sourceRect: session.sourceRect,
          initialPointerPosition: session.startPointerPosition,
          pointerPosition: session.pointerPosition,
          overlayRect,
        })
      : null;

    if (
      areOverlayMeasurementsEqual(
        session.overlayMeasurement,
        overlayMeasurement,
      )
    ) {
      return;
    }

    this.setSession({
      ...session,
      overlayMeasurement,
    });
    this.updatePointerNow(session.rawPointerPosition);
  }

  remeasureDropTargets(input?: RemeasureDropTargetsInput): void {
    const pruneGroup =
      input !== undefined && typeof input !== "string" && !Array.isArray(input)
        ? input.group
        : undefined;

    this.removeDisconnectedDropTargets(pruneGroup);
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
    this.updateOverlayHost = noopUpdateOverlayHost;
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
        draggableId: input.draggableId,
        group: input.group,
        sourceRect: input.sourceRect,
        initialPointerPosition: rawPointerPosition,
      },
    });
    this.activeDragModifiers = activeDragModifiers;
    const effectivePointerPosition = applyDragModifiers({
      activeModifiers: activeDragModifiers,
      draggableId: input.draggableId,
      group: input.group,
      sourceRect: input.sourceRect,
      initialPointerPosition: rawPointerPosition,
      rawPointerPosition,
    });
    const sourceContainerId =
      this.dropTargetRegistry.getDropTargetRegistration(
        input.draggableId,
        input.group,
      )?.containerId ?? null;
    const sourceSortablePlacement = this.dropTargetRegistry.getSortablePlacement(
      input.draggableId,
      input.group,
    );

    const nextSession: DraggingSession = {
      status: "dragging",
      input: input.inputType,
      draggableId: input.draggableId,
      group: input.group,
      sourceRect: input.sourceRect,
      sourceContainerId,
      sourceSortablePlacement,
      overlayMeasurement: null,
      startPointerPosition: rawPointerPosition,
      rawPointerPosition,
      pointerPosition: effectivePointerPosition,
      activeDropTarget: null,
    };

    this.lastDropPlacementInput = null;
    this.lastDropPlacement = null;
    this.setSession(nextSession);
    this.remeasureDropTargets({ group: input.group });

    this.updateOverlayHost({
      type: "mount",
      state: {
        dragState: this.createDragState(nextSession),
        phase: "dragging",
      },
    });
    this.suppressTextSelection();
    if (input.inputType === "pointer") {
      this.bindPointerWindowListeners(input.pointerId);
    } else {
      this.bindKeyboardWindowListeners();
    }
    this.notifyDragStart({
      draggableId: input.draggableId,
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
    const draggableId = session?.draggableId ?? null;
    const dropTarget =
      session && input.dropTarget
        ? this.dropTargetRegistry.getDropTargetRegistration(
            input.dropTarget,
            session.group,
          )
          ? input.dropTarget
          : null
        : null;
    this.lastDropPlacementInput = session
      ? {
          draggableId: session.draggableId,
          group: session.group,
          dropTarget,
          sourceContainerId: session.sourceContainerId,
          sourceSortablePlacement: session.sourceSortablePlacement,
        }
      : null;
    this.lastDropPlacement = this.lastDropPlacementInput
      ? this.dropTargetRegistry.getDropPlacement({
          draggableId: this.lastDropPlacementInput.draggableId,
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

    if (draggableId) {
      this.notifyDragEnd({
        draggableId,
        dropTarget,
      });

      if (dropTarget) {
        this.notifyDrop({
          draggableId,
          dropTarget,
        });
      }
    }

    if (input.keepReleasedOverlay && releasedDragState && this.hasDragOverlay) {
      this.updateOverlayHost({
        type: "release",
        state: {
          dragState: releasedDragState,
          phase: "released",
        },
      });
    } else {
      this.updateOverlayHost({ type: "unmount" });
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
    this.draggedId = this.session.draggableId;
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

  private getSourceSortablePlacement(): SortablePlacement | null {
    const session = this.getDraggingSession();

    return session
      ? session.sourceSortablePlacement
      : this.lastDropPlacementInput?.sourceSortablePlacement ?? null;
  }

  private createDragState(session: DraggingSession): DragState {
    return {
      draggableId: session.draggableId,
      group: session.group,
      sourceRect: session.sourceRect,
      startPointerPosition: session.startPointerPosition,
      pointerPosition: session.pointerPosition,
    };
  }

  private getActiveDropTarget(input: {
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): string | null {
    const session = this.getDraggingSession();

    if (!session) {
      return null;
    }

    this.removeDisconnectedDropTargets(session.group);

    const activeTarget = this.targetingAlgorithm({
      pointerPosition: input.pointerPosition,
      overlayRect: input.overlayRect,
      dropTargets: this.getAvailableDropTargets({
        group: session.group,
        pointerPosition: input.pointerPosition,
        overlayRect: input.overlayRect,
      }),
    });

    return activeTarget?.dropTargetKey ?? null;
  }

  private getSortablePlacementPosition(input: {
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): Point {
    if (this.targetingAlgorithm.mode === "rect" && input.overlayRect) {
      return getRectCenter(input.overlayRect);
    }

    return input.pointerPosition;
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
      overlayMeasurement: session.overlayMeasurement,
    });
  }

  private removeDisconnectedDropTargets(group?: DragGroup): void {
    const removedTargets = this.dropTargetRegistry.pruneDisconnected(group);
    this.clearActiveDropTargetIfRemoved(removedTargets);
  }

  private clearActiveDropTargetIfRemoved(
    removedTargets: RemovedDropTarget[],
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
      this.lifecycleHelpers,
    );

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragStart?.(event);
    }
  }

  private notifyDragUpdate(
    event: DragUpdateEvent,
    subscriptionEvent: DragUpdateSubscriptionEvent,
  ): void {
    this.lifecycleCallbacks.onDragUpdate?.(
      event,
      this.lifecycleHelpers,
    );

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragUpdate?.(subscriptionEvent);
    }
  }

  private notifyDragEnd(event: DragEndEvent): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragEnd?.(event);
    }

    this.lifecycleCallbacks.onDragEnd?.(
      event,
      this.lifecycleHelpers,
    );
  }

  private notifyDrop(event: DropEvent): void {
    this.lifecycleCallbacks.onDrop?.(event, this.lifecycleHelpers);

    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDrop?.(event);
    }
  }
}

function areOverlayMeasurementsEqual(
  previous: DragOverlayMeasurement | null,
  next: DragOverlayMeasurement | null,
): boolean {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  return (
    areNearlyEqual(previous.offsetX, next.offsetX) &&
    areNearlyEqual(previous.offsetY, next.offsetY) &&
    areNearlyEqual(previous.width, next.width) &&
    areNearlyEqual(previous.height, next.height)
  );
}

function areNearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}

function getRectCenter(rect: DragRect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function createDragRuntime(
  options?: DragRuntimeOptions,
): DragRuntime {
  return new DragRuntime(options);
}

function hasRelativeSortablePlacement(placement: DropPlacement): boolean {
  return placement.previousDraggableId !== null || placement.nextDraggableId !== null;
}

function isSameSortablePlacement(
  placement: SortablePlacement,
  sourcePlacement: SortablePlacement | null,
): boolean {
  return (
    sourcePlacement !== null &&
    placement.draggableId === sourcePlacement.draggableId &&
    placement.previousDraggableId === sourcePlacement.previousDraggableId &&
    placement.nextDraggableId === sourcePlacement.nextDraggableId
  );
}
