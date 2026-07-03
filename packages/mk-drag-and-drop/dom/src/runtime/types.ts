import type { DragPoint, DragRect } from "../geometry/rects.js";
import type {
  KeyboardConfiguration,
  PointerConfiguration,
} from "../input/config.js";
import type { DragModifierInput } from "../modifiers/types.js";
import type {
  TargetingAlgorithm,
  TargetingConstraint,
} from "../targeting/types.js";
import type {
  DragLifecycleCallbacks,
} from "./lifecycle.js";
import type {
  KeyboardDragStartInput,
} from "../input/keyboard-drag.js";
import type {
  PointerDragActivationRequest,
} from "../input/pointer-activation.js";
import type { DragGroup } from "./drop-target-registry.js";

export type Point = DragPoint;

export type ActiveDragInput = "pointer" | "keyboard";

export type DragState = {
  itemId: string;
  sourceRect: DragRect;
  startPointerPosition: Point;
  pointerPosition: Point;
};

export type DragOverlayPhase = "dragging" | "released";

export type DragOverlayRenderState = {
  dragState: DragState;
  phase: DragOverlayPhase;
};

export type RequestDragStartInput = PointerDragActivationRequest;

type BaseStartDragInput = {
  itemId: string;
  group: DragGroup;
  pointerPosition: Point;
  sourceRect: DragRect;
};

export type StartDragInput =
  | (BaseStartDragInput & {
      inputType: "pointer";
      pointerId: number;
    })
  | (BaseStartDragInput & {
      inputType: "keyboard";
    });

export type RequestKeyboardDragStartInput = KeyboardDragStartInput;

export type DragRuntimeOptions = {
  setOverlayState?: (overlayState: DragOverlayRenderState | null) => void;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
  hasDragOverlay?: boolean;
  keepOverlayOnDrop?: boolean;
};

export type DragRuntimeConfigureInput = {
  targetingAlgorithm: TargetingAlgorithm;
  targetingConstraint: TargetingConstraint | undefined;
  hasDragOverlay: boolean;
  keepOverlayOnDrop: boolean;
  lifecycleCallbacks: DragLifecycleCallbacks;
  keyboardConfiguration?: KeyboardConfiguration;
  modifiers?: readonly DragModifierInput[];
  pointerConfiguration?: PointerConfiguration;
};
