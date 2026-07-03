import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  pointerToCenter,
  type DragRect,
  type DropTarget,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "@mk-drag-and-drop/core";

type Rect = DragRect;
type DragGroup = string;

export type PointerConfiguration = {
    activationDelay?: number | null;
    activationDistance?: number | null;
};

export type KeyboardCommand =
    | string
    | readonly string[];

export type KeyboardConfiguration = {
    enabled?: boolean;
    start?: KeyboardCommand;
    drop?: KeyboardCommand;
    cancel?: KeyboardCommand;
    moveUp?: KeyboardCommand;
    moveDown?: KeyboardCommand;
    moveLeft?: KeyboardCommand;
    moveRight?: KeyboardCommand;
    moveDistance?: number;
};

export type DragModifierSetupInput = {
    itemId: string;
    group: string;
    sourceRect: DragRect;
    initialPointerPosition: Point;
};

export type DragModifierTransformInput<State = unknown> = {
    itemId: string;
    group: string;
    sourceRect: DragRect;
    initialPointerPosition: Point;
    rawPointerPosition: Point;
    pointerPosition: Point;
    overlayRect: DragRect;
    state: State;
};

export type DragModifier<State = unknown> = {
    setup?: (input: DragModifierSetupInput) => State;
    transform: (input: DragModifierTransformInput<State>) => Point;
};

type NormalizedPointerConfiguration = {
    activationDelay: number | null;
    activationDistance: number | null;
};

type NormalizedKeyboardConfiguration = {
    enabled: boolean;
    start: readonly string[];
    drop: readonly string[];
    cancel: readonly string[];
    moveUp: readonly string[];
    moveDown: readonly string[];
    moveLeft: readonly string[];
    moveRight: readonly string[];
    moveDistance: number;
};

type ActiveDragInput = "pointer" | "keyboard";
type KeyboardMoveDirection = "up" | "down" | "left" | "right";

type ActiveDragModifier = {
    modifier: DragModifier<any>;
    state: any;
};

type DropTargetRegistration = {
    element: HTMLElement;
    group: DragGroup;
    documentRect: DragRect;
};

export type RemeasureDropTargetsInput =
  | string
  | string[]
  | { group: string };

export type Point = {
    x: number;
    y: number;
};

export type DragState = {
    itemId: string;
    sourceRect: Rect;
    startPointerPosition: Point;
    pointerPosition: Point;
};

export type DragOverlayPhase = "dragging" | "released";

export type DragOverlayInput = {
    phase: DragOverlayPhase;
    finish: () => void;
};

type DragOverlayRenderState = {
    dragState: DragState;
    phase: DragOverlayPhase;
};

type DragProviderProps = {
    children: ReactNode;
    dragOverlay?: (overlay: DragOverlayInput) => ReactNode;
    keyboardConfiguration?: KeyboardConfiguration;
    keepOverlayOnDrop?: boolean;
    modifiers?: readonly DragModifier<any>[];
    pointerConfiguration?: PointerConfiguration;
    targetingAlgorithm?: TargetingAlgorithm;
    targetingConstraint?: TargetingConstraint;
} & DragProviderLifecycleCallbacks;

type RequestDragStartInput = {
    itemId: string;
    group: DragGroup;
    element: HTMLElement;
    pointerId: number;
    pointerPosition: Point;
};

type StartDragInput = {
    itemId: string;
    group: DragGroup;
    inputType: ActiveDragInput;
    pointerPosition: Point;
    sourceRect: Rect;
};

type RequestKeyboardDragStartInput = {
    itemId: string;
    group: DragGroup;
    element: HTMLElement;
};

type SourceKeyboardDragKeyDownInput = {
    itemId: string;
    group: DragGroup;
    element: HTMLElement;
    key: string;
};

type PendingDragActivation = {
    itemId: string;
    group: DragGroup;
    element: HTMLElement;
    pointerId: number;
    initialPointerPosition: Point;
    latestPointerPosition: Point;
    timeoutId: number | null;
    cleanupWindowListeners: () => void;
};

export type DragStartEvent = {
    itemId: string;
    pointerPosition: Point;
    sourceRect: Rect;
};

export type DragUpdateEvent = {
    itemId: string;
    pointerPosition: Point;
    activeDropTarget: string | null;
    previousDropTarget: string | null;
};

export type DragEndEvent = {
    itemId: string;
    dropTarget: string | null;
};

export type DropEvent = {
    itemId: string;
    dropTarget: string;
};

export type SortablePlacement = {
    itemId: string;
    previousItemId: string | null;
    nextItemId: string | null;
};

export type DragLifecycleHelpers = {
    getSortablePlacement: (itemId: string) => SortablePlacement | null;
    getDropTargetRect: (dropTargetId: string) => DragRect | null;
};

type DragProviderLifecycleCallbacks = {
    onDragStart?: (
        event: DragStartEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDragUpdate?: (
        event: DragUpdateEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDragEnd?: (
        event: DragEndEvent,
        helpers: DragLifecycleHelpers,
    ) => void;
    onDrop?: (event: DropEvent, helpers: DragLifecycleHelpers) => void;
};

export type DragRuntimeSubscription = {
    onDragStart?: (event: DragStartEvent) => void;
    onDragUpdate?: (event: DragUpdateEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    onDrop?: (event: DropEvent) => void;
};

const defaultKeyboardConfiguration: NormalizedKeyboardConfiguration = {
    enabled: true,
    start: ["Space", "Enter"],
    drop: ["Space", "Enter"],
    cancel: ["Escape"],
    moveUp: ["ArrowUp"],
    moveDown: ["ArrowDown"],
    moveLeft: ["ArrowLeft"],
    moveRight: ["ArrowRight"],
    moveDistance: 24,
};

const emptyDragRect: DragRect = {
    x: 0,
    y: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
};

class DragRuntime {
    isDragging = false;
    draggedId: string | null = null;
    draggedGroup: DragGroup | null = null;
    pointerPosition: Point | null = null;
    dropTargets = new Map<string, DropTargetRegistration>();
    activeDropTarget: string | null = null;

    private dragState: DragState | null = null;
    private activeDragInput: ActiveDragInput | null = null;
    private rawPointerPosition: Point | null = null;
    private modifiers: readonly DragModifier<any>[] = [];
    private activeDragModifiers: ActiveDragModifier[] = [];
    private cleanupWindowListeners: (() => void) | null = null;
    private cleanupTextSelectionSuppression: (() => void) | null = null;
    private subscriptions = new Set<DragRuntimeSubscription>();
    private lifecycleCallbacks: DragProviderLifecycleCallbacks = {};
    private dropTargetElements = new WeakMap<HTMLElement, string>();
    private pointerConfiguration: NormalizedPointerConfiguration = {
      activationDelay: null,
      activationDistance: null,
    };
    private keyboardConfiguration: NormalizedKeyboardConfiguration =
      defaultKeyboardConfiguration;
    private pendingDragActivation: PendingDragActivation | null = null;

    constructor(
      private setOverlayState: (
        overlayState: DragOverlayRenderState | null,
      ) => void,
      private targetingAlgorithm: TargetingAlgorithm = pointerToCenter,
      private hasDragOverlay = false,
      private keepOverlayOnDrop = false,
      private targetingConstraint: TargetingConstraint | undefined = undefined,
    ) {}

    configure(input: {
      targetingAlgorithm: TargetingAlgorithm;
      targetingConstraint: TargetingConstraint | undefined;
      hasDragOverlay: boolean;
      keepOverlayOnDrop: boolean;
      lifecycleCallbacks: DragProviderLifecycleCallbacks;
      keyboardConfiguration?: KeyboardConfiguration;
      modifiers?: readonly DragModifier<any>[];
      pointerConfiguration?: PointerConfiguration;
    }): void {
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
        this.cancelPendingDragActivation();

        if (this.isDragging) {
            return;
        }

        const { activationDelay, activationDistance } =
          this.pointerConfiguration;

        if (activationDelay === null && activationDistance === null) {
            this.startDragNow({
                itemId: input.itemId,
                group: input.group,
                inputType: "pointer",
                pointerPosition: input.pointerPosition,
                sourceRect: input.element.getBoundingClientRect(),
            });
            return;
        }

        const initialPointerPosition = {
            x: input.pointerPosition.x,
            y: input.pointerPosition.y,
        };
        const pendingActivation: PendingDragActivation = {
            itemId: input.itemId,
            group: input.group,
            element: input.element,
            pointerId: input.pointerId,
            initialPointerPosition,
            latestPointerPosition: initialPointerPosition,
            timeoutId: null,
            cleanupWindowListeners: () => {},
        };

        const handlePointerMove = (event: PointerEvent): void => {
            if (event.pointerId !== pendingActivation.pointerId) {
                return;
            }

            const pointerPosition = {
                x: event.clientX,
                y: event.clientY,
            };

            pendingActivation.latestPointerPosition = pointerPosition;

            if (activationDistance === null) {
                return;
            }

            const distance = Math.hypot(
                pointerPosition.x - initialPointerPosition.x,
                pointerPosition.y - initialPointerPosition.y,
            );

            if (distance >= activationDistance) {
                this.activatePendingDragActivation(pendingActivation);
            }
        };

        const handlePointerEnd = (event: PointerEvent): void => {
            if (event.pointerId !== pendingActivation.pointerId) {
                return;
            }

            this.cancelPendingDragActivation();
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);

        pendingActivation.cleanupWindowListeners = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
        };

        if (activationDelay !== null) {
            pendingActivation.timeoutId = window.setTimeout(() => {
                this.activatePendingDragActivation(pendingActivation);
            }, activationDelay);
        }

        this.pendingDragActivation = pendingActivation;
    }

    isKeyboardDragEnabled(): boolean {
        return this.keyboardConfiguration.enabled;
    }

    handleSourceKeyboardKeyDown(input: SourceKeyboardDragKeyDownInput): boolean {
        if (!this.keyboardConfiguration.enabled) {
            return false;
        }

        if (!this.isDragging) {
            if (
                !isKeyboardCommandMatch(
                    input.key,
                    this.keyboardConfiguration.start,
                )
            ) {
                return false;
            }

            this.requestKeyboardDragStart({
                itemId: input.itemId,
                group: input.group,
                element: input.element,
            });
            return true;
        }

        if (this.activeDragInput !== "keyboard") {
            return false;
        }

        return this.handleActiveKeyboardKeyDown(input.key);
    }

    requestKeyboardDragStart(input: RequestKeyboardDragStartInput): void {
        this.cancelPendingDragActivation();

        if (
            this.isDragging ||
            !this.keyboardConfiguration.enabled ||
            !input.element.isConnected
        ) {
            return;
        }

        const sourceRect = input.element.getBoundingClientRect();
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

    private startDragNow(input: StartDragInput): void {
        if (this.targetingAlgorithm.mode === "rect" && !this.hasDragOverlay) {
            throw new Error(
                "The selected targeting algorithm requires a drag overlay. Provide dragOverlay or use a pointer-based targeting algorithm.",
            );
        }

        const rawPointerPosition = input.pointerPosition;
        const activeDragModifiers = this.createActiveDragModifiers({
            itemId: input.itemId,
            group: input.group,
            sourceRect: input.sourceRect,
            initialPointerPosition: rawPointerPosition,
        });
        this.activeDragModifiers = activeDragModifiers;
        const effectivePointerPosition = this.applyDragModifiers({
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

    updatePointer(rawPointerPosition: Point): void {
      if (!this.isDragging || !this.dragState) return;

      const itemId = this.dragState.itemId;
      const group = this.draggedGroup;
      const previousDropTarget = this.activeDropTarget;

      if (group === null) {
        return;
      }

      const pointerPosition = this.applyDragModifiers({
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

    private finishDrag(input: {
      dropTarget: string | null;
      keepReleasedOverlay: boolean;
    }): void {
      this.cancelPendingDragActivation();

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

    registerDropTarget(
      id: string,
      element: HTMLElement,
      group: DragGroup,
    ): void {
      const previousTarget = this.dropTargets.get(id);

      if (previousTarget && previousTarget.element !== element) {
        this.dropTargetElements.delete(previousTarget.element);
      }

      this.dropTargets.set(id, {
        element,
        group,
        documentRect: emptyDragRect,
      });
      this.dropTargetElements.set(element, id);
      this.remeasureDropTarget(id);
    }

    unregisterDropTarget(id: string): void {
      const target = this.dropTargets.get(id);

      if (target) {
        this.dropTargetElements.delete(target.element);
      }

      this.dropTargets.delete(id);
    }

    getSortablePlacement(itemId: string): SortablePlacement | null {
      const registration = this.dropTargets.get(itemId);

      if (!registration?.element.parentElement) {
        return null;
      }

      const { element, group } = registration;

      return {
        itemId,
        previousItemId: this.getNearestSortableSiblingItemId(
          element.previousElementSibling,
          group,
          "previous",
        ),
        nextItemId: this.getNearestSortableSiblingItemId(
          element.nextElementSibling,
          group,
          "next",
        ),
      };
    }

    getDropTargetRect(dropTargetId: string): DragRect | null {
      const registration = this.dropTargets.get(dropTargetId);

      return registration
        ? documentRectToViewportRect(registration.documentRect)
        : null;
    }

    getCurrentDragRect(): DragRect | null {
      return this.pointerPosition
        ? this.getCurrentDragRectAt(this.pointerPosition)
        : null;
    }

    remeasureDropTargets(input?: RemeasureDropTargetsInput): void {
      if (input === undefined) {
        for (const dropTarget of this.dropTargets.values()) {
          this.remeasureDropTargetRegistration(dropTarget);
        }

        return;
      }

      if (typeof input === "string") {
        this.remeasureDropTarget(input);
        return;
      }

      if (Array.isArray(input)) {
        for (const dropTargetId of input) {
          this.remeasureDropTarget(dropTargetId);
        }

        return;
      }

      for (const dropTarget of this.dropTargets.values()) {
        if (dropTarget.group === input.group) {
          this.remeasureDropTargetRegistration(dropTarget);
        }
      }
    }

    subscribe(subscription: DragRuntimeSubscription): () => void {
      this.subscriptions.add(subscription);

      return () => {
        this.subscriptions.delete(subscription);
      };
    }

    private createActiveDragModifiers(
        input: DragModifierSetupInput,
    ): ActiveDragModifier[] {
        return this.modifiers.map((modifier) => ({
            modifier,
            state: modifier.setup?.(input),
        }));
    }

    private applyDragModifiers(input: {
        itemId: string;
        group: DragGroup;
        sourceRect: DragRect;
        initialPointerPosition: Point;
        rawPointerPosition: Point;
    }): Point {
        let pointerPosition = input.rawPointerPosition;

        for (const activeModifier of this.activeDragModifiers) {
            const overlayRect = getOverlayRect({
                sourceRect: input.sourceRect,
                initialPointerPosition: input.initialPointerPosition,
                pointerPosition,
            });

            pointerPosition = activeModifier.modifier.transform({
                itemId: input.itemId,
                group: input.group,
                sourceRect: input.sourceRect,
                initialPointerPosition: input.initialPointerPosition,
                rawPointerPosition: input.rawPointerPosition,
                pointerPosition,
                overlayRect,
                state: activeModifier.state,
            });
        }

        return pointerPosition;
    }

    private activatePendingDragActivation(
        pendingActivation: PendingDragActivation,
    ): void {
        if (this.pendingDragActivation !== pendingActivation) {
            return;
        }

        this.cancelPendingDragActivation();

        if (this.isDragging || !pendingActivation.element.isConnected) {
            return;
        }

        this.startDragNow({
            itemId: pendingActivation.itemId,
            group: pendingActivation.group,
            inputType: "pointer",
            pointerPosition: pendingActivation.initialPointerPosition,
            sourceRect: pendingActivation.element.getBoundingClientRect(),
        });

        if (
            pendingActivation.latestPointerPosition.x !==
              pendingActivation.initialPointerPosition.x ||
            pendingActivation.latestPointerPosition.y !==
              pendingActivation.initialPointerPosition.y
        ) {
            this.updatePointer(pendingActivation.latestPointerPosition);
        }
    }

    private cancelPendingDragActivation(): void {
        const pendingActivation = this.pendingDragActivation;

        if (!pendingActivation) {
            return;
        }

        if (pendingActivation.timeoutId !== null) {
            window.clearTimeout(pendingActivation.timeoutId);
        }

        pendingActivation.cleanupWindowListeners();
        this.pendingDragActivation = null;
    }

    private handleActiveKeyboardKeyDown(key: string): boolean {
        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.moveUp)) {
            this.moveKeyboardDrag("up");
            return true;
        }

        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.moveDown)) {
            this.moveKeyboardDrag("down");
            return true;
        }

        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.moveLeft)) {
            this.moveKeyboardDrag("left");
            return true;
        }

        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.moveRight)) {
            this.moveKeyboardDrag("right");
            return true;
        }

        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.drop)) {
            this.endDrag();
            return true;
        }

        if (isKeyboardCommandMatch(key, this.keyboardConfiguration.cancel)) {
            this.cancelDrag();
            return true;
        }

        return false;
    }

    private bindPointerWindowListeners(): void {
      this.cleanupWindowListeners?.();

      const handlePointerMove = (event: PointerEvent) => {
        this.updatePointer({
          x: event.clientX,
          y: event.clientY,
        });
      };

      const handlePointerEnd = () => {
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

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (!this.handleActiveKeyboardKeyDown(event.key)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      };

      window.addEventListener("keydown", handleKeyDown);

      this.cleanupWindowListeners = () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
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
      const dropTargets: DropTarget[] = [];

      if (this.draggedGroup === null) {
        return dropTargets;
      }

      for (const [dropTargetKey, dropTarget] of this.dropTargets) {
        if (dropTarget.group !== this.draggedGroup) {
          continue;
        }

        const candidateDropTarget = {
          dropTargetKey,
          dropTargetRect: documentRectToViewportRect(dropTarget.documentRect),
        };

        if (
          this.targetingConstraint &&
          !this.targetingConstraint({
            pointerPosition: input.pointerPosition,
            overlayRect: input.overlayRect,
            dropTarget: candidateDropTarget,
          })
        ) {
          continue;
        }

        dropTargets.push(candidateDropTarget);
      }

      return dropTargets;
    }

    private remeasureDropTarget(dropTargetId: string): void {
      const dropTarget = this.dropTargets.get(dropTargetId);

      if (!dropTarget) {
        return;
      }

      this.remeasureDropTargetRegistration(dropTarget);
    }

    private remeasureDropTargetRegistration(
      registration: DropTargetRegistration,
    ): void {
      registration.documentRect =
        this.measureDropTargetRegistration(registration);
    }

    private measureDropTargetRegistration(
      registration: DropTargetRegistration,
    ): DragRect {
      return measureDocumentRect(registration.element);
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

    private getNearestSortableSiblingItemId(
      element: Element | null,
      group: DragGroup,
      direction: "previous" | "next",
    ): string | null {
      let currentElement = element;

      while (currentElement) {
        const itemId = this.getSortableItemId(currentElement, group);

        if (itemId) {
          return itemId;
        }

        currentElement =
          direction === "previous"
            ? currentElement.previousElementSibling
            : currentElement.nextElementSibling;
      }

      return null;
    }

    private getSortableItemId(element: Element, group: DragGroup): string | null {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const itemId = this.dropTargetElements.get(element);
      const registration = itemId ? this.dropTargets.get(itemId) : null;

      if (!registration || registration.group !== group) {
        return null;
      }

      return itemId ?? null;
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

export const DragContext = createContext<unknown | null>(null);

export function useRemeasureDropTargets(): (
  input?: RemeasureDropTargetsInput,
) => void {
  const runtime = useContext(DragContext) as DragRuntime | null;

  if (!runtime) {
    throw new Error("useRemeasureDropTargets must be used inside DragProvider");
  }

  return useCallback((input?: RemeasureDropTargetsInput) => {
    runtime.remeasureDropTargets(input);
  }, [runtime]);
}

export function DragProvider({
    children,
    dragOverlay,
    keyboardConfiguration,
    keepOverlayOnDrop = false,
    modifiers,
    pointerConfiguration,
    targetingAlgorithm = pointerToCenter,
    targetingConstraint,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onDrop,
}: DragProviderProps) {
    const [overlayState, setOverlayState] =
      useState<DragOverlayRenderState | null>(null);
    const runtimeRef = useRef<DragRuntime | null>(null);

    if (runtimeRef.current === null) {
      runtimeRef.current = new DragRuntime(
        setOverlayState,
        targetingAlgorithm,
        dragOverlay !== undefined,
        keepOverlayOnDrop,
        targetingConstraint,
      );
    }

    runtimeRef.current.configure({
      targetingAlgorithm,
      targetingConstraint,
      hasDragOverlay: dragOverlay !== undefined,
      keepOverlayOnDrop,
      lifecycleCallbacks: {
        onDragStart,
        onDragUpdate,
        onDragEnd,
        onDrop,
      },
      keyboardConfiguration,
      modifiers,
      pointerConfiguration,
    });

    function finishOverlay(): void {
      setOverlayState(null);
    }

    return (
      <DragContext value={runtimeRef.current}>
        {children}
        {dragOverlay && overlayState ? (
          <DragOverlay dragState={overlayState.dragState}>
            {dragOverlay({
              phase: overlayState.phase,
              finish: finishOverlay,
            })}
          </DragOverlay>
        ) : null}
      </DragContext>
    );
}

function translateRect(rect: DragRect, deltaX: number, deltaY: number): DragRect {
  return {
    x: rect.x + deltaX,
    y: rect.y + deltaY,
    top: rect.top + deltaY,
    right: rect.right + deltaX,
    bottom: rect.bottom + deltaY,
    left: rect.left + deltaX,
    width: rect.width,
    height: rect.height,
  };
}

function getOverlayRect(input: {
  sourceRect: DragRect;
  initialPointerPosition: Point;
  pointerPosition: Point;
}): DragRect {
  const deltaX = input.pointerPosition.x - input.initialPointerPosition.x;
  const deltaY = input.pointerPosition.y - input.initialPointerPosition.y;

  return translateRect(input.sourceRect, deltaX, deltaY);
}

function measureDocumentRect(element: HTMLElement): DragRect {
  const viewportRect = element.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    x: viewportRect.x + scrollX,
    y: viewportRect.y + scrollY,
    top: viewportRect.top + scrollY,
    right: viewportRect.right + scrollX,
    bottom: viewportRect.bottom + scrollY,
    left: viewportRect.left + scrollX,
    width: viewportRect.width,
    height: viewportRect.height,
  };
}

export function lockToXAxis(): DragModifier {
  return {
    transform: (input) => ({
      x: input.pointerPosition.x,
      y: input.initialPointerPosition.y,
    }),
  };
}

export function lockToYAxis(): DragModifier {
  return {
    transform: (input) => ({
      x: input.initialPointerPosition.x,
      y: input.pointerPosition.y,
    }),
  };
}

export function restrictToContainer(
  containerRef: RefObject<HTMLElement | null>,
): DragModifier<DragRect | null> {
  return {
    setup: () => {
      const container = containerRef.current;

      return container
        ? rectToDragRect(container.getBoundingClientRect())
        : null;
    },
    transform: (input) => {
      if (input.state === null) {
        return input.pointerPosition;
      }

      return {
        x: clampPointerAxis({
          pointerPosition: input.pointerPosition.x,
          overlayStart: input.overlayRect.left,
          overlayEnd: input.overlayRect.right,
          containerStart: input.state.left,
          containerEnd: input.state.right,
        }),
        y: clampPointerAxis({
          pointerPosition: input.pointerPosition.y,
          overlayStart: input.overlayRect.top,
          overlayEnd: input.overlayRect.bottom,
          containerStart: input.state.top,
          containerEnd: input.state.bottom,
        }),
      };
    },
  };
}

function documentRectToViewportRect(rect: DragRect): DragRect {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    x: rect.x - scrollX,
    y: rect.y - scrollY,
    top: rect.top - scrollY,
    right: rect.right - scrollX,
    bottom: rect.bottom - scrollY,
    left: rect.left - scrollX,
    width: rect.width,
    height: rect.height,
  };
}

function rectToDragRect(rect: DOMRect): DragRect {
  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function clampPointerAxis(input: {
  pointerPosition: number;
  overlayStart: number;
  overlayEnd: number;
  containerStart: number;
  containerEnd: number;
}): number {
  const overlaySize = input.overlayEnd - input.overlayStart;
  const containerSize = input.containerEnd - input.containerStart;

  if (overlaySize > containerSize) {
    // Oversized overlays pin their leading edge to the container to avoid
    // alternating between opposite edges on repeated modifier runs.
    return input.pointerPosition + input.containerStart - input.overlayStart;
  }

  if (input.overlayStart < input.containerStart) {
    return input.pointerPosition + input.containerStart - input.overlayStart;
  }

  if (input.overlayEnd > input.containerEnd) {
    return input.pointerPosition - (input.overlayEnd - input.containerEnd);
  }

  return input.pointerPosition;
}

function normalizeKeyboardConfiguration(
  keyboardConfiguration: KeyboardConfiguration | undefined,
): NormalizedKeyboardConfiguration {
  return {
    enabled: keyboardConfiguration?.enabled ?? defaultKeyboardConfiguration.enabled,
    start: normalizeKeyboardCommand(
      keyboardConfiguration?.start,
      defaultKeyboardConfiguration.start,
    ),
    drop: normalizeKeyboardCommand(
      keyboardConfiguration?.drop,
      defaultKeyboardConfiguration.drop,
    ),
    cancel: normalizeKeyboardCommand(
      keyboardConfiguration?.cancel,
      defaultKeyboardConfiguration.cancel,
    ),
    moveUp: normalizeKeyboardCommand(
      keyboardConfiguration?.moveUp,
      defaultKeyboardConfiguration.moveUp,
    ),
    moveDown: normalizeKeyboardCommand(
      keyboardConfiguration?.moveDown,
      defaultKeyboardConfiguration.moveDown,
    ),
    moveLeft: normalizeKeyboardCommand(
      keyboardConfiguration?.moveLeft,
      defaultKeyboardConfiguration.moveLeft,
    ),
    moveRight: normalizeKeyboardCommand(
      keyboardConfiguration?.moveRight,
      defaultKeyboardConfiguration.moveRight,
    ),
    moveDistance: normalizeKeyboardMoveDistance(
      keyboardConfiguration?.moveDistance,
    ),
  };
}

function normalizeKeyboardCommand(
  command: KeyboardCommand | undefined,
  defaultCommand: readonly string[],
): readonly string[] {
  const commandKeys =
    command === undefined
      ? defaultCommand
      : typeof command === "string"
        ? [command]
        : command;

  return commandKeys.map(normalizeKeyboardKey);
}

function normalizeKeyboardKey(key: string): string {
  return key === " " ? "Space" : key;
}

function normalizeKeyboardMoveDistance(
  moveDistance: number | undefined,
): number {
  return typeof moveDistance === "number" &&
    Number.isFinite(moveDistance) &&
    moveDistance > 0
    ? moveDistance
    : defaultKeyboardConfiguration.moveDistance;
}

function isKeyboardCommandMatch(
  key: string,
  command: readonly string[],
): boolean {
  return command.includes(normalizeKeyboardKey(key));
}

function normalizePointerConfiguration(
  pointerConfiguration: PointerConfiguration | undefined,
): NormalizedPointerConfiguration {
  return {
    activationDelay: normalizePointerActivationValue(
      pointerConfiguration?.activationDelay,
    ),
    activationDistance: normalizePointerActivationValue(
      pointerConfiguration?.activationDistance,
    ),
  };
}

function normalizePointerActivationValue(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function DragOverlay({
    dragState,
    children,
}: {
    dragState: DragState;
    children: ReactNode;
}) {
    const x = dragState.pointerPosition.x - dragState.startPointerPosition.x;
    const y = dragState.pointerPosition.y - dragState.startPointerPosition.y;

    return (
      <div
        style={{
          position: "fixed",
          left: dragState.sourceRect.left,
          top: dragState.sourceRect.top,
          width: dragState.sourceRect.width,
          height: dragState.sourceRect.height,
          pointerEvents: "auto",
          zIndex: 9999,
          transform: `translate3d(${x}px, ${y}px, 0)`,
        }}
      >
        {children}
      </div>
    );
}

