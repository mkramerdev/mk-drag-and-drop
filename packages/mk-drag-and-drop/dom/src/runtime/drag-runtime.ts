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
import { globalPointerListenerCapture } from "../input/global-pointer-listeners.js";
import { acquireDocumentSelectionSuppression } from "../input/document-selection-state.js";
import { suppressNativeDragStart } from "../input/native-drag-suppression.js";
import { PointerActivationController } from "../input/pointer-activation.js";
import { acquireDocumentPointerDragState } from "../input/pointer-drag-state.js";
import {
  applyDragModifiers,
  createActiveDragModifiers,
} from "../modifiers/pipeline.js";
import {
  type ActiveDragModifier,
  type DragModifierInput,
} from "../modifiers/types.js";
import {
  getBuiltInTargetingAlgorithmKind,
  pointerToCenter,
} from "../targeting/algorithms.js";
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
  ActiveDragResetEvent,
  SortablePreview,
} from "./lifecycle.js";
import { getSortableCoordinator } from "./sortable-coordinator.js";
import type {
  DragOverlayHostUpdate,
  DragRuntimeConfigureInput,
  DragRuntimeOptions,
  DragState,
  OverlayReleaseMode,
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
      sourceSortableElement: HTMLElement | null;
      overlayMeasurement: DragOverlayMeasurement | null;
      startPointerPosition: Point;
      rawPointerPosition: Point;
      pointerPosition: Point;
      activeDropTargetId: string | null;
      sortablePreview: SortablePreview;
    };

type DraggingSession = Extract<DragSession, { status: "dragging" }>;

export type StaleDomBindingRecord = {
  release: () => void;
  isConnected: () => boolean;
};

type StoredStaleDomBindingRecord = {
  record: StaleDomBindingRecord;
  hasBeenConnected: boolean;
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
  private releaseActiveInputListeners: (() => void) | null = null;
  private ensureActivePointerCapture: (() => void) | null = null;
  private restoreTextSelectionSuppression: (() => void) | null = null;
  private releasePointerDragState: (() => void) | null = null;
  private releasePostDragClickSuppression: (() => void) | null = null;
  private queuedPointerPosition: Point | null = null;
  private pointerFrameId: number | null = null;
  private pointerFrameWindow: (Window & typeof globalThis) | null = null;
  private activeDragWindow: (Window & typeof globalThis) | null = null;
  private subscriptions = new Set<DragRuntimeSubscription>();
  private staleDomBindingRecords = new Set<StoredStaleDomBindingRecord>();
  private lifecycleCallbacks: DragLifecycleCallbacks = {};
  private lifecycleHelpers: DragLifecycleHelpers = {
    getDropTargetRect: (dropTargetId) =>
      this.getLifecycleDropTargetRect(dropTargetId),
  };
  private lifecycleDropTargetRectSnapshot: Map<string, DragRect | null> | null =
    null;
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
  private overlayRelease: OverlayReleaseMode;
  private targetingConstraint: TargetingConstraint | undefined;
  private pointerActivation = new PointerActivationController({
    getConfiguration: () => this.pointerConfiguration,
    isDragging: () => this.isDragging,
    acquirePendingResources: ({ element }) => {
      const restoreTextSelection = acquireDocumentSelectionSuppression(
        element.ownerDocument,
      );
      const releaseNativeDragSuppression = suppressNativeDragStart(element);
      return () => {
        releaseNativeDragSuppression();
        restoreTextSelection();
      };
    },
    startImmediately: (request) => {
      if (!request.element.isConnected) {
        return;
      }

      this.startDragNow({
        draggableId: request.draggableId,
        group: request.group,
        inputType: "pointer",
        pointerId: request.pointerId,
        pointerCaptureTarget: request.pointerCaptureTarget ?? request.element,
        pointerType: request.pointerType,
        element: request.element,
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
        pointerCaptureTarget: activation.pointerCaptureTarget,
        pointerType: activation.pointerType,
        element: activation.element,
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
    this.overlayRelease = options.overlayRelease ?? "auto";
    this.targetingConstraint = options.targetingConstraint;
  }

  configure(input: DragRuntimeConfigureInput): void {
    this.hasDragOverlay = input.hasDragOverlay;
    this.overlayRelease = input.overlayRelease;
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
    this.clearPostDragClickSuppression();
    this.pruneDisconnectedDomBindings();
    this.pointerActivation.request(input);
  }

  isKeyboardDragEnabled(): boolean {
    return this.keyboardDrag.isEnabled();
  }

  handleSourceKeyboardKeyDown(input: KeyboardSourceKeyDownInput): boolean {
    return this.keyboardDrag.handleSourceKeyDown(input);
  }

  requestKeyboardDragStart(input: RequestKeyboardDragStartInput): void {
    this.pruneDisconnectedDomBindings();
    this.cancelPendingActivation();

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
      element: input.element,
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

    this.updatePointerNowOrRelease(pointerPosition);
  }

  updatePointer(rawPointerPosition: Point): void {
    if (this.session.status !== "dragging") {
      return;
    }

    this.queuedPointerPosition = rawPointerPosition;

    if (this.pointerFrameId !== null) {
      return;
    }

    const targetWindow = this.activeDragWindow ?? window;
    this.pointerFrameWindow = targetWindow;
    this.pointerFrameId = targetWindow.requestAnimationFrame(() => {
      this.pointerFrameId = null;
      this.pointerFrameWindow = null;
      const nextPointerPosition = this.queuedPointerPosition;
      this.queuedPointerPosition = null;

      if (nextPointerPosition) {
        this.updatePointerNowOrRelease(nextPointerPosition);
      }
    });
  }

  recomputeActiveDrag(): void {
    const session = this.getDraggingSession();

    if (!session) {
      return;
    }

    this.updatePointerNowOrRelease(session.rawPointerPosition);
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
    const sortablePlacementPosition = this.getSortablePlacementPosition({
      pointerPosition,
      overlayRect,
    });
    const activeDropTargetId = this.getActiveDropTargetId({
      pointerPosition,
      overlayRect,
    });
    const nextSession: DraggingSession = {
      ...session,
      rawPointerPosition,
      pointerPosition,
      activeDropTargetId,
      sortablePreview: session.sortablePreview,
    };
    this.setSession(nextSession);

    this.updateOverlayHost({
      type: "move",
      dragState: this.createDragState(nextSession),
    });
    getSortableCoordinator(this)?.update({
      draggableId: nextSession.draggableId,
      group: nextSession.group,
      source: nextSession.source,
      pointerPosition,
      activeDropTargetId: nextSession.activeDropTargetId,
      placementPosition: sortablePlacementPosition,
      movementPosition: rawPointerPosition,
    });
    this.ensureActivePointerCapture?.();
    const sortablePreview = this.getSortablePreview(nextSession);
    const completedSession: DraggingSession = {
      ...nextSession,
      sortablePreview,
    };
    this.setSession(completedSession);
    const updateEvent: DragUpdateEvent = {
      draggableId: completedSession.draggableId,
      group: completedSession.group,
      source: completedSession.source,
      pointerPosition,
      overlayRect,
      activeDropTargetId: completedSession.activeDropTargetId,
      previousDropTargetId,
      sortablePreview,
    };

    this.notifyDragUpdate(updateEvent);
  }

  private updatePointerNowOrRelease(rawPointerPosition: Point): void {
    try {
      this.updatePointerNow(rawPointerPosition);
    } catch (error) {
      this.releaseActiveDragResourcesAndRethrow(error);
    }
  }

  private finishDragAfterQueuedPointerUpdate(input: {
    reason: "drop" | "cancel";
    overlayRelease: OverlayReleaseMode;
  }): void {
    try {
      this.flushQueuedPointerUpdate();
    } catch (error) {
      this.releaseActiveDragResourcesAndRethrow(error);
    }

    this.finishDrag(input);
  }

  endDrag(): void {
    this.finishDragAfterQueuedPointerUpdate({
      reason: "drop",
      overlayRelease: this.overlayRelease,
    });
  }

  cancelDrag(): void {
    this.cancelQueuedPointerUpdate();
    this.finishDrag({
      reason: "cancel",
      overlayRelease: this.overlayRelease,
    });
  }

  cancelPendingActivation(): void {
    this.pointerActivation.cancelPendingActivation();
  }

  registerDropTarget(
    dropTargetId: string,
    element: HTMLElement,
    group: DragGroup,
    options?: RegisterDropTargetOptions,
  ): void {
    this.dropTargetRegistry.register(dropTargetId, element, group, options);
  }

  unregisterDropTarget(dropTargetId: string, element?: HTMLElement): void {
    this.dropTargetRegistry.unregister(dropTargetId, element);
  }

  registerDropContainer(
    containerId: string,
    element: HTMLElement,
    group: DragGroup,
  ): void {
    this.dropTargetRegistry.register(containerId, element, group, {
      containerId,
      container: true,
    });
  }

  unregisterDropContainer(containerId: string, element?: HTMLElement): void {
    this.dropTargetRegistry.unregister(containerId, element);
  }

  releaseActiveDragResources(): void {
    const activeSession = this.getDraggingSession();
    this.cancelPendingActivation();

    let firstReleaseError: unknown;
    let hasReleaseError = false;

    if (activeSession) {
      try {
        getSortableCoordinator(this)?.release({
          draggableId: activeSession.draggableId,
          group: activeSession.group,
        });
      } catch (error) {
        firstReleaseError = error;
        hasReleaseError = true;
      }

      try {
        this.notifyActiveDragReset({
          draggableId: activeSession.draggableId,
          group: activeSession.group,
          source: activeSession.source,
        });
      } catch (error) {
        if (!hasReleaseError) {
          firstReleaseError = error;
          hasReleaseError = true;
        }
      }
    }

    this.resetActiveDragState();

    try {
      this.releaseActiveInputResources();
    } catch (error) {
      firstReleaseError = error;
      hasReleaseError = true;
    }

    try {
      this.clearOverlayHost();
    } catch (error) {
      if (!hasReleaseError) {
        firstReleaseError = error;
        hasReleaseError = true;
      }
    }

    this.clearPostDragClickSuppression();

    if (hasReleaseError) {
      throw firstReleaseError;
    }
  }

  private releaseActiveDragResourcesAndRethrow(error: unknown): never {
    try {
      this.releaseActiveDragResources();
    } catch {
      // Preserve the original failure while still making a best effort to
      // release resources that were acquired before it was thrown.
    }

    throw error;
  }

  getDropTargetRect(dropTargetId: string): DragRect | null {
    return this.dropTargetRegistry.getViewportRect(dropTargetId);
  }

  getDropTargetRegistration(dropTargetId: string, group?: DragGroup) {
    return this.dropTargetRegistry.getDropTargetRegistration(
      dropTargetId,
      group,
    );
  }

  getCurrentDragRect(): DragRect | null {
    const session = this.getDraggingSession();

    return session ? this.getCurrentDragRectAt(session.pointerPosition) : null;
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
    this.updatePointerNowOrRelease(session.rawPointerPosition);
  }

  remeasureDropTargets(input?: RemeasureDropTargetsInput): void {
    const pruneGroup =
      input !== undefined && typeof input !== "string" && !Array.isArray(input)
        ? input.group
        : undefined;

    this.pruneDisconnectedDomBindings();
    this.removeDisconnectedDropTargets(pruneGroup);
    this.dropTargetRegistry.remeasure(input);
    this.pruneDisconnectedDomBindings();
  }

  subscribe(subscription: DragRuntimeSubscription): () => void {
    this.subscriptions.add(subscription);

    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  registerStaleDomBinding(record: StaleDomBindingRecord): () => void {
    const storedRecord: StoredStaleDomBindingRecord = {
      record,
      hasBeenConnected: record.isConnected(),
    };

    // Keep registration O(1). Full stale DOM pruning runs on drag lifecycle and
    // explicit remeasurement paths so bulk renders do not rescan prior bindings.
    this.staleDomBindingRecords.add(storedRecord);

    return () => {
      if (!this.staleDomBindingRecords.delete(storedRecord)) {
        return;
      }

      record.release();
    };
  }

  pruneDisconnectedDomBindings(): void {
    this.pruneDisconnectedDomBindingRecords();
  }

  getStaleDomBindingRecordCount(): number {
    return this.staleDomBindingRecords.size;
  }

  private startDragNow(input: StartDragInput): void {
    this.cancelPendingActivation();

    try {
      if (this.targetingAlgorithm.mode === "rect" && !this.hasDragOverlay) {
        throw new Error(
          "The selected targeting algorithm requires a drag overlay. Provide dragOverlay or use a pointer-based targeting algorithm.",
        );
      }

      this.pruneDisconnectedDomBindings();

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
      const sourceSortableRegistration =
        this.dropTargetRegistry.getDropTargetRegistration(
          input.draggableId,
          input.group,
        );
      const sourceSortableElement =
        sourceSortablePlacement &&
        sourceSortableRegistration?.capabilities.sortable
          ? sourceSortableRegistration.element
          : null;

      const nextSession: DraggingSession = {
        status: "dragging",
        source: input.inputType,
        draggableId: input.draggableId,
        group: input.group,
        sourceRect: input.sourceRect,
        sourceContainerId,
        sourceSortablePlacement,
        sourceSortableElement,
        overlayMeasurement: null,
        startPointerPosition: rawPointerPosition,
        rawPointerPosition,
        pointerPosition: effectivePointerPosition,
        activeDropTargetId: null,
        sortablePreview: { status: "inactive" },
      };

      this.setSession(nextSession);
      this.activeDragWindow = input.element.ownerDocument.defaultView ?? window;

      if (input.inputType === "pointer") {
        this.releasePointerDragState = acquireDocumentPointerDragState(
          input.element.ownerDocument,
        );
      }

      this.remeasureDropTargets({ group: input.group });

      const dragStartEvent: DragStartEvent = {
        draggableId: input.draggableId,
        group: input.group,
        source: input.inputType,
        pointerPosition: effectivePointerPosition,
        sourceRect: input.sourceRect,
      };
      const startOverlayRect = this.hasDragOverlay
        ? this.getCurrentDragRectAt(effectivePointerPosition)
        : null;
      const placementPosition = this.getSortablePlacementPosition({
        pointerPosition: effectivePointerPosition,
        overlayRect: startOverlayRect,
      });
      getSortableCoordinator(this)?.start({
        ...dragStartEvent,
        placementPosition,
        movementPosition: rawPointerPosition,
      });

      this.notifyDragStartSubscriptions(dragStartEvent);
      this.updateOverlayHost({
        type: "mount",
        state: {
          dragState: this.createDragState(nextSession),
          phase: "dragging",
        },
      });
      this.suppressTextSelection(input.element.ownerDocument);
      if (input.inputType === "pointer") {
        this.bindPointerWindowListeners(
          input.pointerId,
          input.element,
          input.pointerCaptureTarget ?? input.element,
        );
      } else {
        this.bindKeyboardWindowListeners(this.activeDragWindow);
      }
      this.notifyDragStartLifecycle(dragStartEvent);
    } catch (error) {
      this.releaseActiveDragResourcesAndRethrow(error);
    }
  }

  private finishDrag(input: {
    reason: "drop" | "cancel";
    overlayRelease: OverlayReleaseMode;
  }): void {
    this.cancelPendingActivation();

    const session = this.getDraggingSession();
    const releasedDragState = session ? this.createDragState(session) : null;
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
    const overlayRect =
      session && this.hasDragOverlay
        ? this.getCurrentDragRectAt(session.pointerPosition)
        : null;
    const sortablePlacement =
      session && dropTargetId
        ? this.getDropEventSortablePlacement(session)
        : undefined;
    const lifecycleDropTargetRectSnapshot = session
      ? this.createLifecycleDropTargetRectSnapshot({
          session,
          dropTargetId,
        })
      : null;

    this.resetActiveDragState();
    let finishError: unknown;
    let hasFinishError = false;

    try {
      this.releaseActiveInputResources();
    } catch (error) {
      finishError = error;
      hasFinishError = true;
    }

    if (session) {
      try {
        getSortableCoordinator(this)?.release({
          draggableId: session.draggableId,
          group: session.group,
        });
      } catch (error) {
        if (!hasFinishError) {
          finishError = error;
          hasFinishError = true;
        }
      }
    }

    if (session && result && !hasFinishError) {
      this.lifecycleDropTargetRectSnapshot = lifecycleDropTargetRectSnapshot;

      try {
        this.notifyDragEnd({
          draggableId: session.draggableId,
          group: session.group,
          source: session.source,
          result,
          overlayRect,
          dropTargetId,
        });

        if (result === "dropped" && dropTargetId) {
          this.notifyDrop({
            draggableId: session.draggableId,
            group: session.group,
            source: session.source,
            dropTargetId,
            ...(sortablePlacement ? { sortablePlacement } : {}),
          });
        }
      } catch (error) {
        finishError = error;
        hasFinishError = true;
      } finally {
        this.lifecycleDropTargetRectSnapshot = null;
      }
    }

    try {
      this.releaseOverlayAfterDrag({
        overlayRelease: input.overlayRelease,
        releasedDragState,
      });
    } catch (error) {
      if (!hasFinishError) {
        finishError = error;
        hasFinishError = true;
      }
    }

    if (hasFinishError) {
      throw finishError;
    }
  }

  private releaseOverlayAfterDrag(input: {
    overlayRelease: OverlayReleaseMode;
    releasedDragState: DragState | null;
  }): void {
    if (
      input.overlayRelease === "manual" &&
      input.releasedDragState &&
      this.hasDragOverlay
    ) {
      try {
        this.updateOverlayHost({
          type: "release",
          state: {
            dragState: input.releasedDragState,
            phase: "released",
          },
        });
      } catch (error) {
        try {
          this.clearOverlayHost();
        } catch {
          // Preserve the overlay release error while still making a best effort
          // to clear the host state.
        }

        throw error;
      }
      return;
    }

    this.clearOverlayHost();
  }

  private bindPointerWindowListeners(
    pointerId: number,
    initiatingElement: HTMLElement,
    pointerCaptureTarget: Element,
  ): void {
    this.releaseActiveInputListeners?.();
    const targetWindow = initiatingElement.ownerDocument.defaultView ?? window;
    const releaseNativeDragSuppression =
      suppressNativeDragStart(initiatingElement);

    let listenersReleased = false;
    const ensurePointerCapture = (): void => {
      if (
        !pointerCaptureTarget.isConnected ||
        typeof pointerCaptureTarget.setPointerCapture !== "function"
      ) {
        return;
      }

      try {
        if (
          typeof pointerCaptureTarget.hasPointerCapture === "function" &&
          pointerCaptureTarget.hasPointerCapture(pointerId)
        ) {
          return;
        }

        pointerCaptureTarget.setPointerCapture(pointerId);
      } catch {
        // Window listeners remain the fallback when capture is unavailable.
      }
    };
    const releasePointerCapture = (): void => {
      if (typeof pointerCaptureTarget.releasePointerCapture !== "function") {
        return;
      }

      try {
        if (
          typeof pointerCaptureTarget.hasPointerCapture !== "function" ||
          pointerCaptureTarget.hasPointerCapture(pointerId)
        ) {
          pointerCaptureTarget.releasePointerCapture(pointerId);
        }
      } catch {
        // Pointerup/cancel may have already released capture implicitly.
      }
    };
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

      try {
        this.endDrag();
        this.suppressNextRelatedClick(initiatingElement);
      } catch (error) {
        this.clearPostDragClickSuppression();
        throw error;
      }
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      this.clearPostDragClickSuppression();
      this.cancelDrag();
    };

    targetWindow.addEventListener(
      "pointermove",
      handlePointerMove,
      globalPointerListenerCapture,
    );
    targetWindow.addEventListener(
      "pointerup",
      handlePointerUp,
      globalPointerListenerCapture,
    );
    targetWindow.addEventListener(
      "pointercancel",
      handlePointerCancel,
      globalPointerListenerCapture,
    );

    this.ensureActivePointerCapture = ensurePointerCapture;
    ensurePointerCapture();

    this.releaseActiveInputListeners = () => {
      if (listenersReleased) {
        return;
      }

      listenersReleased = true;
      if (this.ensureActivePointerCapture === ensurePointerCapture) {
        this.ensureActivePointerCapture = null;
      }
      releaseNativeDragSuppression();
      releasePointerCapture();
      targetWindow.removeEventListener(
        "pointermove",
        handlePointerMove,
        globalPointerListenerCapture,
      );
      targetWindow.removeEventListener(
        "pointerup",
        handlePointerUp,
        globalPointerListenerCapture,
      );
      targetWindow.removeEventListener(
        "pointercancel",
        handlePointerCancel,
        globalPointerListenerCapture,
      );
    };
  }

  private bindKeyboardWindowListeners(
    targetWindow: Window & typeof globalThis,
  ): void {
    this.releaseActiveInputListeners?.();
    this.releaseActiveInputListeners =
      this.keyboardDrag.bindWindowListeners(targetWindow);
  }

  private suppressNextRelatedClick(initiatingElement: HTMLElement): void {
    this.clearPostDragClickSuppression();
    const targetWindow = initiatingElement.ownerDocument.defaultView ?? window;

    let timeoutId: number | null = null;
    const handleClick = (event: MouseEvent): void => {
      if (
        event.detail === 0 ||
        !(event.target instanceof targetWindow.Node) ||
        !initiatingElement.contains(event.target)
      ) {
        return;
      }

      this.clearPostDragClickSuppression();
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const release = (): void => {
      targetWindow.removeEventListener("click", handleClick, true);

      if (timeoutId !== null) {
        targetWindow.clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (this.releasePostDragClickSuppression === release) {
        this.releasePostDragClickSuppression = null;
      }
    };

    targetWindow.addEventListener("click", handleClick, true);
    this.releasePostDragClickSuppression = release;
    timeoutId = targetWindow.setTimeout(release, 0);
  }

  private clearPostDragClickSuppression(): void {
    const release = this.releasePostDragClickSuppression;
    this.releasePostDragClickSuppression = null;
    release?.();
  }

  private suppressTextSelection(sourceDocument: Document): void {
    this.restoreTextSelectionSuppression?.();
    this.restoreTextSelectionSuppression =
      acquireDocumentSelectionSuppression(sourceDocument);
  }

  private resetActiveDragState(): void {
    this.cancelQueuedPointerUpdate();
    this.setSession({ status: "idle" });
    this.activeDragModifiers = [];
    this.activeDragWindow = null;
  }

  private releaseActiveInputResources(): void {
    const releaseActiveInputListeners = this.releaseActiveInputListeners;
    this.releaseActiveInputListeners = null;
    this.ensureActivePointerCapture = null;
    const restoreTextSelectionSuppression =
      this.restoreTextSelectionSuppression;
    this.restoreTextSelectionSuppression = null;
    const releasePointerDragState = this.releasePointerDragState;
    this.releasePointerDragState = null;

    let releaseError: unknown;
    let hasReleaseError = false;

    try {
      releaseActiveInputListeners?.();
    } catch (error) {
      releaseError = error;
      hasReleaseError = true;
    }

    try {
      restoreTextSelectionSuppression?.();
    } catch (error) {
      if (!hasReleaseError) {
        releaseError = error;
        hasReleaseError = true;
      }
    }

    try {
      releasePointerDragState?.();
    } catch (error) {
      if (!hasReleaseError) {
        releaseError = error;
        hasReleaseError = true;
      }
    }

    if (hasReleaseError) {
      throw releaseError;
    }
  }

  private clearOverlayHost(): void {
    this.updateOverlayHost({ type: "unmount" });
  }

  private flushQueuedPointerUpdate(): void {
    if (this.pointerFrameId !== null) {
      (this.pointerFrameWindow ?? window).cancelAnimationFrame(
        this.pointerFrameId,
      );
      this.pointerFrameId = null;
      this.pointerFrameWindow = null;
    }

    const nextPointerPosition = this.queuedPointerPosition;
    this.queuedPointerPosition = null;

    if (nextPointerPosition) {
      this.updatePointerNow(nextPointerPosition);
    }
  }

  private cancelQueuedPointerUpdate(): void {
    if (this.pointerFrameId !== null) {
      (this.pointerFrameWindow ?? window).cancelAnimationFrame(
        this.pointerFrameId,
      );
      this.pointerFrameId = null;
      this.pointerFrameWindow = null;
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
  ): SortableDropPlacement | undefined {
    const preview = this.getSortablePreview(session);

    return preview.status === "projected" ? preview.placement : undefined;
  }

  private getSortablePreview(session: DraggingSession): SortablePreview {
    const currentRegistration =
      this.dropTargetRegistry.getDropTargetRegistration(
        session.draggableId,
        session.group,
      );

    if (
      !session.sourceSortablePlacement ||
      !session.sourceSortableElement ||
      !currentRegistration?.capabilities.sortable ||
      currentRegistration.element !== session.sourceSortableElement
    ) {
      return { status: "inactive" };
    }

    const placement = this.dropTargetRegistry.normalizeSortablePlacement({
      draggableId: session.draggableId,
      activeDropTargetId: session.activeDropTargetId,
      group: session.group,
      sourceContainerId: session.sourceContainerId,
    });

    if (!placement) {
      return { status: "inactive" };
    }

    if (isSameSortableLocation(placement, session.sourceSortablePlacement)) {
      return {
        status: "source",
        placement: {
          sourceContainerId: session.sourceContainerId,
          containerId: session.sourceContainerId,
          previousDraggableId:
            session.sourceSortablePlacement.previousDraggableId,
          nextDraggableId: session.sourceSortablePlacement.nextDraggableId,
          targetDraggableId: null,
          side: null,
        },
      };
    }

    return { status: "projected", placement };
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

  private getLifecycleDropTargetRect(dropTargetId: string): DragRect | null {
    if (this.lifecycleDropTargetRectSnapshot?.has(dropTargetId)) {
      return this.lifecycleDropTargetRectSnapshot.get(dropTargetId) ?? null;
    }

    return this.getDropTargetRect(dropTargetId);
  }

  private createLifecycleDropTargetRectSnapshot(input: {
    session: DraggingSession;
    dropTargetId: string | null;
  }): Map<string, DragRect | null> | null {
    const dropTargetIds = new Set<string>([input.session.draggableId]);

    if (input.dropTargetId) {
      dropTargetIds.add(input.dropTargetId);
    }

    if (dropTargetIds.size === 0) {
      return null;
    }

    const snapshot = new Map<string, DragRect | null>();

    for (const dropTargetId of dropTargetIds) {
      const registration = this.dropTargetRegistry.getDropTargetRegistration(
        dropTargetId,
        input.session.group,
      );

      snapshot.set(
        dropTargetId,
        registration ? measureDomElement(registration.element) : null,
      );
    }

    return snapshot;
  }

  private getActiveDropTargetId(input: {
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): string | null {
    const session = this.getDraggingSession();

    if (!session) {
      return null;
    }

    const activeTarget = this.targetingAlgorithm({
      pointerPosition: input.pointerPosition,
      overlayRect: input.overlayRect,
      dropTargets: this.getAvailableDropTargets({
        group: session.group,
        draggingDraggableId: session.draggableId,
        activeDropTargetId: session.activeDropTargetId,
        sourceContainerId: session.sourceContainerId,
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
    draggingDraggableId: string;
    activeDropTargetId: string | null;
    sourceContainerId: string | null;
    pointerPosition: Point;
    overlayRect: DragRect | null;
  }): DropTarget[] {
    return this.dropTargetRegistry.getAvailableDropTargets({
      group: input.group,
      draggingDraggableId: input.draggingDraggableId,
      activeDropTargetId: input.activeDropTargetId,
      sourceContainerId: input.sourceContainerId,
      pointerPosition: input.pointerPosition,
      overlayRect: input.overlayRect,
      targetingAlgorithmKind: getBuiltInTargetingAlgorithmKind(
        this.targetingAlgorithm,
      ),
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
    this.dropTargetRegistry.pruneDisconnected(group);
  }

  private pruneDisconnectedDomBindingRecords(
    skipRecord?: StoredStaleDomBindingRecord,
  ): void {
    for (const storedRecord of Array.from(this.staleDomBindingRecords)) {
      if (storedRecord === skipRecord) {
        continue;
      }

      if (storedRecord.record.isConnected()) {
        storedRecord.hasBeenConnected = true;
        continue;
      }

      if (!storedRecord.hasBeenConnected) {
        continue;
      }

      this.staleDomBindingRecords.delete(storedRecord);
      storedRecord.record.release();
    }
  }

  private notifyDragStartSubscriptions(
    subscriptionEvent: DragStartEvent,
  ): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragStart?.(subscriptionEvent);
    }
  }

  private notifyDragStartLifecycle(event: DragStartEvent): void {
    this.lifecycleCallbacks.onDragStart?.(event, this.lifecycleHelpers);
  }

  private notifyDragUpdate(event: DragUpdateEvent): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragUpdate?.(event);
    }

    this.lifecycleCallbacks.onDragUpdate?.(event, this.lifecycleHelpers);
  }

  private notifyDragEnd(event: DragEndEvent): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDragEnd?.(event);
    }

    this.lifecycleCallbacks.onDragEnd?.(event, this.lifecycleHelpers);
  }

  private notifyDrop(event: DropEvent): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onDrop?.(event);
    }

    this.lifecycleCallbacks.onDrop?.(event, this.lifecycleHelpers);
  }

  private notifyActiveDragReset(event: ActiveDragResetEvent): void {
    for (const subscription of Array.from(this.subscriptions)) {
      subscription.onActiveDragReset?.(event);
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

export function createDragRuntime(options?: DragRuntimeOptions): DragRuntime {
  return new DragRuntime(options);
}

function isSameSortableLocation(
  placement: SortableDropPlacement,
  sourcePlacement: SortableItemPlacement | null,
): boolean {
  return !(
    sourcePlacement === null ||
    placement.containerId !== sourcePlacement.containerId ||
    placement.previousDraggableId !== sourcePlacement.previousDraggableId ||
    placement.nextDraggableId !== sourcePlacement.nextDraggableId
  );
}
