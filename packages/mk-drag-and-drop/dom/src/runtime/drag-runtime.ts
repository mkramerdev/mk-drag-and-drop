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
  type RegisterDropTargetOptions,
  type RemeasureDropTargetsInput,
  type RemovedDropTarget,
  type SortableDropPlacement,
  type SortableItemPlacement,
} from "./drop-target-registry.js";
import type {
  DragEndEvent,
  DragLifecycleCallbacks,
  DragLifecycleHelpers,
  DragSource,
  DragRuntimeSubscription,
  DragStartEvent,
  DragUpdateEvent,
  DropEvent,
} from "./lifecycle.js";
import type {
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
      source: DragSource;
      draggableId: string;
      group: DragGroup;
      sourceRect: DragRect;
      sourceContainerId: string | null;
      sourceSortablePlacement: SortableItemPlacement | null;
      overlayMeasurement: DragOverlayMeasurement | null;
      startPointerPosition: Point;
      rawPointerPosition: Point;
      pointerPosition: Point;
      activeDropTargetId: string | null;
    };

type DraggingSession = Extract<DragSession, { status: "dragging" }>;

type DragUpdateSubscriptionEvent = DragUpdateEvent & {
  placementPosition: Point;
};

export type BindingCleanupRecord = {
  cleanup: () => void;
  isConnected: () => boolean;
};

export class DragRuntime {
  isDragging = false;
  draggedId: string | null = null;
  draggedGroup: DragGroup | null = null;
  pointerPosition: Point | null = null;
  activeDropTargetId: string | null = null;

  private session: DragSession = { status: "idle" };
  private modifiers: readonly DragModifierInput[] = [];
  private activeDragModifiers: ActiveDragModifier[] = [];
  private cleanupWindowListeners: (() => void) | null = null;
  private cleanupTextSelectionSuppression: (() => void) | null = null;
  private queuedPointerPosition: Point | null = null;
  private pointerFrameId: number | null = null;
  private subscriptions = new Set<DragRuntimeSubscription>();
  private disposeCallbacks = new Set<() => void>();
  private bindingCleanupRecords = new Set<BindingCleanupRecord>();
  private lifecycleCallbacks: DragLifecycleCallbacks = {};
  private lifecycleHelpers: DragLifecycleHelpers = {
    getDropTargetRect: (dropTargetId) => this.getDropTargetRect(dropTargetId),
  };
  private dropTargetRegistry = new DropTargetRegistry();
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
    this.pruneDisconnectedBindingCleanups();
    this.pointerActivation.request(input);
  }

  isKeyboardDragEnabled(): boolean {
    return this.keyboardDrag.isEnabled();
  }

  handleSourceKeyboardKeyDown(input: KeyboardSourceKeyDownInput): boolean {
    return this.keyboardDrag.handleSourceKeyDown(input);
  }

  requestKeyboardDragStart(input: RequestKeyboardDragStartInput): void {
    this.pruneDisconnectedBindingCleanups();
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

    if (!session || session.source !== "keyboard") {
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

    const previousDropTargetId = session.activeDropTargetId;
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
    const activeDropTargetId = this.getActiveDropTargetId({
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
      activeDropTargetId,
    };
    this.setSession(nextSession);

    this.updateOverlayHost({
      type: "move",
      dragState: this.createDragState(nextSession),
    });
    const updateEvent: DragUpdateEvent = {
      draggableId: nextSession.draggableId,
      source: nextSession.source,
      pointerPosition,
      activeDropTargetId: nextSession.activeDropTargetId,
      previousDropTargetId,
    };

    this.notifyDragUpdate(updateEvent, {
      ...updateEvent,
      placementPosition,
    });
  }

  endDrag(): void {
    this.flushQueuedPointerUpdate();
    this.finishDrag({
      reason: "drop",
      keepReleasedOverlay: this.keepOverlayOnDrop,
    });
  }

  cancelDrag(): void {
    this.flushQueuedPointerUpdate();
    this.finishDrag({
      reason: "cancel",
      keepReleasedOverlay: false,
    });
  }

  registerDropTarget(
    dropTargetId: string,
    element: HTMLElement,
    group: DragGroup,
    options?: RegisterDropTargetOptions,
  ): void {
    const removedTargets = this.dropTargetRegistry.register(
      dropTargetId,
      element,
      group,
      options,
    );

    this.clearActiveDropTargetIdIfRemoved(removedTargets);
  }

  unregisterDropTarget(dropTargetId: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(
      dropTargetId,
      element,
    );

    this.clearActiveDropTargetIdIfRemoved(removedTargets);
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

    this.clearActiveDropTargetIdIfRemoved(removedTargets);
  }

  unregisterDropContainer(containerId: string, element?: HTMLElement): void {
    const removedTargets = this.dropTargetRegistry.unregister(containerId, element);

    this.clearActiveDropTargetIdIfRemoved(removedTargets);
  }

  cleanup(): void {
    this.pointerActivation.cancel();
    this.resetActiveDragState();
    this.cleanupActiveDragResources();
    this.updateOverlayHost({ type: "unmount" });
    this.pruneDisconnectedBindingCleanups();
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

    this.pruneDisconnectedBindingCleanups();
    this.removeDisconnectedDropTargets(pruneGroup);
    this.dropTargetRegistry.remeasure(input);
    this.pruneDisconnectedBindingCleanups();
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

  registerBindingCleanup(record: BindingCleanupRecord): () => void {
    this.pruneDisconnectedBindingCleanupRecords();
    this.bindingCleanupRecords.add(record);
    this.pruneDisconnectedBindingCleanupRecords(record);

    return () => {
      if (!this.bindingCleanupRecords.delete(record)) {
        return;
      }

      record.cleanup();
    };
  }

  pruneDisconnectedBindingCleanups(): void {
    this.pruneDisconnectedBindingCleanupRecords();
  }

  getBindingCleanupRecordCount(): number {
    return this.bindingCleanupRecords.size;
  }

  dispose(): void {
    this.cleanup();
    this.disposeBindingCleanupRecords();

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

    this.pruneDisconnectedBindingCleanups();

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
    const sourceSortablePlacement =
      this.dropTargetRegistry.getSortableItemPlacement(
        input.draggableId,
        input.group,
      );

    const nextSession: DraggingSession = {
      status: "dragging",
      source: input.inputType,
      draggableId: input.draggableId,
      group: input.group,
      sourceRect: input.sourceRect,
      sourceContainerId,
      sourceSortablePlacement,
      overlayMeasurement: null,
      startPointerPosition: rawPointerPosition,
      rawPointerPosition,
      pointerPosition: effectivePointerPosition,
      activeDropTargetId: null,
    };

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
      source: input.inputType,
      pointerPosition: effectivePointerPosition,
      sourceRect: input.sourceRect,
    });
  }

  private finishDrag(input: {
    reason: "drop" | "cancel";
    keepReleasedOverlay: boolean;
  }): void {
    this.pointerActivation.cancel();

    const session = this.getDraggingSession();
    const releasedDragState = session
      ? this.createDragState(session)
      : null;
    const activeDropTargetId =
      input.reason === "drop" ? session?.activeDropTargetId ?? null : null;
    const validDropTarget =
      session && activeDropTargetId
        ? this.dropTargetRegistry.getDropTargetRegistration(
            activeDropTargetId,
            session.group,
          )
        : null;
    const dropTargetId = validDropTarget ? activeDropTargetId : null;
    const result = session
      ? input.reason === "cancel"
        ? "canceled"
        : activeDropTargetId === null
          ? "no-target"
          : validDropTarget
            ? "dropped"
            : "invalid-target"
      : null;
    const sortablePlacement =
      session && dropTargetId
        ? this.getDropEventSortablePlacement(session, dropTargetId)
        : undefined;

    this.resetActiveDragState();
    this.cleanupActiveDragResources();

    if (session && result) {
      this.notifyDragEnd({
        draggableId: session.draggableId,
        source: session.source,
        result,
        dropTargetId,
      });

      if (result === "dropped" && dropTargetId) {
        this.notifyDrop({
          draggableId: session.draggableId,
          source: session.source,
          dropTargetId,
          ...(sortablePlacement ? { sortablePlacement } : {}),
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
      this.activeDropTargetId = null;
      return;
    }

    this.isDragging = true;
    this.draggedId = this.session.draggableId;
    this.draggedGroup = this.session.group;
    this.pointerPosition = this.session.pointerPosition;
    this.activeDropTargetId = this.session.activeDropTargetId;
  }

  private getActiveInput(): DragSource | null {
    return this.session.status === "dragging" ? this.session.source : null;
  }

  private getDraggingSession(): DraggingSession | null {
    return this.session.status === "dragging" ? this.session : null;
  }

  private getDropEventSortablePlacement(
    session: DraggingSession,
    dropTargetId: string,
  ): SortableDropPlacement | undefined {
    const placement = this.dropTargetRegistry.getSortableDropPlacement({
      draggableId: session.draggableId,
      dropTargetId,
      group: session.group,
      sourceContainerId: session.sourceContainerId,
    });

    if (
      !placement ||
      isSameSortablePlacement(placement, session.sourceSortablePlacement)
    ) {
      return undefined;
    }

    return placement;
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

  private getActiveDropTargetId(input: {
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

    return activeTarget?.dropTargetId ?? null;
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
    this.clearActiveDropTargetIdIfRemoved(removedTargets);
  }

  private pruneDisconnectedBindingCleanupRecords(
    skipRecord?: BindingCleanupRecord,
  ): void {
    for (const record of Array.from(this.bindingCleanupRecords)) {
      if (record === skipRecord || record.isConnected()) {
        continue;
      }

      this.bindingCleanupRecords.delete(record);
      record.cleanup();
    }
  }

  private disposeBindingCleanupRecords(): void {
    for (const record of Array.from(this.bindingCleanupRecords)) {
      this.bindingCleanupRecords.delete(record);
      record.cleanup();
    }
  }

  private clearActiveDropTargetIdIfRemoved(
    removedTargets: RemovedDropTarget[],
  ): void {
    if (this.session.status !== "dragging") {
      return;
    }

    const session = this.session;
    const removedActiveTarget = removedTargets.some(
      (removedTarget) =>
        removedTarget.id === session.activeDropTargetId &&
        removedTarget.group === session.group,
    );

    if (!removedActiveTarget) {
      return;
    }

    this.setSession({
      ...session,
      activeDropTargetId: null,
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

function isSameSortablePlacement(
  placement: SortableDropPlacement,
  sourcePlacement: SortableItemPlacement | null,
): boolean {
  return (
    sourcePlacement !== null &&
    placement.containerId === sourcePlacement.containerId &&
    placement.previousDraggableId === sourcePlacement.previousDraggableId &&
    placement.nextDraggableId === sourcePlacement.nextDraggableId
  );
}
