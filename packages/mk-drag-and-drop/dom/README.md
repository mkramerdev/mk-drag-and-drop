# @mk-drag-and-drop/dom

`@mk-drag-and-drop/dom` is the DOM-first behavior package for
`mk-drag-and-drop`. It handles pointer and keyboard drag input, target
registration and measurement, targeting, lifecycle callbacks, drag overlays,
movement modifiers, sortable previews, and drop-container placement.

The package is headless. Apps own DOM structure, rendering, styling, data,
persistence, and final commits. The DOM package reports what happened; it does
not own application data.

## Import Paths

Use the root package import for application code:

```ts
import {
  createDragController,
  createDraggable,
  createDroppable,
  createSortable,
} from "@mk-drag-and-drop/dom";
```

The package also exports `@mk-drag-and-drop/dom/integration` for adapter authors
who need lower-level DOM behavior factories and a runtime scope. Deep imports
into `src` or `dist` files are not part of the public package exports.

## Public Root API

The root export includes:

- `createDragController`
- `createDraggable`
- `createDroppable`
- `createDropContainer`
- `createSortable`
- `createDragHandle`
- controller types: `DragController`, `DragControllerOptions`,
  `DragControllerOverlayInput`, `DragControllerAnnouncements`
- lifecycle types: `DragStartEvent`, `DragUpdateEvent`, `DragEndEvent`,
  `DropEvent`, `DragSource`, `DragEndResult`, `DragLifecycleCallbacks`,
  `DragLifecycleHelpers`
- placement types: `SortableDropPlacement`, `RemeasureDropTargetsInput`
- overlay types: `OverlayReleaseMode`
- targeting helpers and types: `pointerToCenter`, `centerToCenter`,
  `pointerToRectDistance`, `getDistanceToRect`,
  `maxPointerDistanceToRect`, `maxOverlayCenterDistanceToRect`, `DropTarget`,
  `TargetingAlgorithm`, `TargetingAlgorithmInput`,
  `TargetingConstraint`, `TargetingConstraintInput`
- modifiers and types: `lockToXAxis`, `lockToYAxis`, `restrictToContainer`,
  `RestrictToContainerResolver`, `DragModifier`, `DragModifierInput`,
  `DragModifierSetupInput`, `DragModifierTransformInput`
- input and geometry types: `KeyboardCommand`, `KeyboardConfiguration`,
  `PointerConfiguration`, `DragPoint`, `DragRect`

Internal classes and helpers such as the underlying runtime class, registries,
input controllers, measurement helpers, sortable preview internals, and modifier
pipeline internals are not public root APIs.

## Integration Subpath

`@mk-drag-and-drop/dom/integration` exports:

- `createDragRuntimeScope`
- `DragRuntimeScope`, `DragRuntimeScopeOptions`,
  `DragRuntimeScopeConfigureInput`
- `DragState`, `DragOverlayPhase`, `DragOverlayRenderState`,
  `OverlayReleaseMode`
- `DragRuntimeSubscription`
- `createDomDraggable`, `createDomDroppable`, `createDomDropContainer`,
  `createDomSortable`
- the related DOM behavior/input/runtime types
- `domDragHandleAttribute`

Use this subpath when building a framework adapter or custom behavior layer. For
ordinary DOM usage, prefer the root controller and binding helpers.

## Controller

`createDragController(options?)` creates the public DOM drag-and-drop scope used
by the root binding helpers. Controller options include:

- lifecycle callbacks: `onDragStart`, `onDragUpdate`, `onDragEnd`, `onDrop`
- `announcements`: lifecycle callbacks that return polite live-region text
- `dragOverlay(input)`: returns an overlay `HTMLElement` or `null`
- `overlayRoot`: optional root for the DOM overlay wrapper
- `overlayRelease`: `"auto"` removes overlays on drag end; `"manual"` keeps a
  released overlay until its `removeOverlay` callback is called
- `targetingAlgorithm` and `targetingConstraint`
- `modifiers`
- `pointerConfiguration`
- `keyboardConfiguration`

The returned controller has:

- `remeasureDropTargets(input?)`: remeasures all targets, one target id, an
  array of target ids, or `{ group }`
- `remeasureOverlay()`: remeasures the currently mounted drag overlay element;
  it is a safe no-op when no overlay is mounted or no drag is active

The controller does not expose runtime teardown, disposal, update, or broad
overlay removal methods. Runtime objects are ordinary JavaScript objects; DOM
bindings and active drag resources are owned by their own lifetimes.

## Drag Overlays

`dragOverlay(input)` is a creation hook. The controller calls it when overlay
content is mounted for the `"dragging"` phase. By default, overlays are removed
immediately when a drag ends. When `overlayRelease: "manual"` is configured, the
controller calls `dragOverlay` once more for the `"released"` phase and passes
`removeOverlay`; call that function when app-owned release animation is done.
Pointer movement does not call `dragOverlay`.

The overlay input includes:

- `dragState`: item id, group, source rect, start pointer, and current pointer.
- `phase`: `"dragging"` or `"released"`.
- `remeasureOverlay`: manually refreshes the cached overlay measurement.
- `removeOverlay`: present only for `"released"` overlays in manual release
  mode; call it when app-owned release animation should remove the overlay.

`removeOverlay` is only present for released overlays in manual release mode.
Calling it more than once is safe. It removes the overlay host state only; it is
not a controller or runtime teardown API.

Apps own the returned overlay element and any dynamic content inside it. The
package owns the overlay wrapper, movement, release, and geometry measurement
used by targeting and modifiers. The wrapper is positioned with `position:
fixed`, source rect dimensions, `pointer-events: none`, and a transform derived
from the current pointer delta.

The controller measures the returned overlay element on mount/replacement. When
`ResizeObserver` is available, it also remeasures when that element changes
size. The runtime derives the current overlay rect from that cached measurement
plus modified pointer movement, and it does not measure overlay DOM on every
pointer move.

Manual `remeasureOverlay()` is for cases automatic observation cannot cover or
where the app knows visual geometry changed. CSS transforms can change visual
bounds without necessarily triggering `ResizeObserver`.

```ts
controller.remeasureOverlay();
```

```ts
const controller = createDragController({
  dragOverlay({ dragState, remeasureOverlay }) {
    const element = document.createElement("div");
    element.textContent = dragState.draggableId;

    element.addEventListener("transitionend", () => {
      remeasureOverlay();
    });

    return element;
  },
});
```

For dynamic overlay content, keep a reference to the element and update it from
lifecycle callbacks or subscriptions:

```ts
let overlayElement: HTMLElement | null = null;

const controller = createDragController({
  dragOverlay({ dragState }) {
    overlayElement = document.createElement("div");
    overlayElement.textContent = dragState.draggableId;
    return overlayElement;
  },
  onDragUpdate({ pointerPosition }) {
    if (overlayElement) {
      overlayElement.textContent = `${pointerPosition.x}, ${pointerPosition.y}`;
    }
  },
  onDragEnd() {
    overlayElement = null;
  },
});
```

## Lifecycle Events

Lifecycle callbacks receive an event and helper methods.

Event shapes:

```ts
type DragStartEvent = {
  draggableId: string;
  source: DragSource;
  pointerPosition: DragPoint;
  sourceRect: DragRect;
};

type DragUpdateEvent = {
  draggableId: string;
  source: DragSource;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  activeDropTargetId: string | null;
  previousDropTargetId: string | null;
};

type DragSource = "pointer" | "keyboard";

type DragEndResult =
  | "dropped"
  | "no-target"
  | "invalid-target"
  | "canceled";

type DragEndEvent = {
  draggableId: string;
  source: DragSource;
  result: DragEndResult;
  dropTargetId: string | null;
  overlayRect: DragRect | null;
};

type DropEvent = {
  draggableId: string;
  source: DragSource;
  dropTargetId: string;
  sortablePlacement?: SortableDropPlacement;
};

type SortableDropPlacement = {
  sourceContainerId: string | null;
  containerId: string | null;
  previousDraggableId: string | null;
  nextDraggableId: string | null;
  targetDraggableId: string | null;
  side: "before" | "after" | null;
};
```

`DragUpdateEvent.overlayRect` is the current viewport-space rectangle for the
drag overlay. `DragEndEvent.overlayRect` is the final viewport-space rectangle
at the moment the drag ends. Both are `null` when no drag overlay is configured.
When an overlay is configured, the runtime uses cached overlay measurement plus
modified pointer movement. Before overlay content has been measured, it uses the
same translated source-rect fallback as the visual overlay. The drag update and
drag end paths do not read overlay DOM just to produce this field.

Helpers:

- `getDropTargetRect(dropTargetId)`

`onDrop` only runs for a valid successful drop. `onDragEnd` runs whenever a drag
ends. `result: "dropped"` means a valid target was accepted and `onDrop` also
runs. `result: "no-target"` means the user ended normally with no active target.
`result: "invalid-target"` means an active target candidate was stale by drag
end. `result: "canceled"` means the drag was canceled, such as Escape,
pointercancel, or runtime cancellation.

## Bindings

Root binding helpers attach behavior to DOM elements and return `void`.
Registrations are WeakRef-backed and stale disconnected elements are pruned on
drag-critical paths and explicit remeasurement.

`createDraggable(input)` accepts:

- `controller`
- `element`
- `draggableId`
- `group`, defaulting to `"default"`

`createDroppable(input)` accepts:

- `controller`
- `element`
- `dropTargetId`
- `group`, defaulting to `"default"`
- `containerId`, defaulting to `null`

`createDropContainer(input)` accepts:

- `controller`
- `element`
- `containerId`
- `group`, defaulting to `"default"`

`createSortable(input)` accepts:

- `controller`
- `element`
- `draggableId`
- `group`, defaulting to `"default"`
- `containerId`, defaulting to `null`

`createDragHandle({ element })` marks an element with the drag-handle data
attribute. When a draggable or sortable contains a handle, pointer and keyboard
dragging are handled from that handle instead of unrelated children.

## Placement Data

Plain droppable drops are id-only: `draggableId`, `dropTargetId`, and `source`.
Sortable behavior may add sortable-specific placement under
`event.sortablePlacement`:

```ts
type SortableDropPlacement = {
  sourceContainerId: string | null;
  containerId: string | null;
  previousDraggableId: string | null;
  nextDraggableId: string | null;
  targetDraggableId: string | null;
  side: "before" | "after" | null;
};
```

No sortable placement is included for plain droppable drops. No-op sortable drops
may omit `sortablePlacement`.
`targetDraggableId` and `side` preserve the active sortable item anchor when a
drop lands relative to an item. They are `null` for container-only placements.

Sortable behavior owns only a transient DOM preview during the drag. It may move
DOM nodes to show where an item would land, but it does not commit app data. On
drop, the app reads `event.sortablePlacement` and updates its own data/rendering.

## Targeting

A measured target passed to custom targeting code has:

```ts
type DropTarget = {
  dropTargetId: string;
  dropTargetRect: DragRect;
};
```

Built-in targeting algorithms:

- `pointerToCenter`
- `centerToCenter`
- `pointerToRectDistance`

Built-in targeting helpers/constraints:

- `getDistanceToRect(point, rect)`
- `maxPointerDistanceToRect({ maxDistance?, maxXDistance?, maxYDistance? })`
- `maxOverlayCenterDistanceToRect({ maxDistance?, maxXDistance?, maxYDistance? })`

Custom `TargetingAlgorithm` functions receive `pointerPosition`, `overlayRect`,
and the filtered `dropTargets` list. Algorithms decide which geometry to use:
`pointerToCenter` and `pointerToRectDistance` are pointer based, while
`centerToCenter` computes the overlay center from `overlayRect` and returns no
target when no overlay rect is available. Custom `TargetingConstraint`
functions receive `pointerPosition`, `overlayRect`, and one `dropTarget`, and
return whether that candidate is eligible. Use the pointer or overlay-center
distance helper that matches the intended behavior.

Sortable placement is separate from targeting. The configured targeting
algorithm alone chooses `activeDropTarget`; sortable only decides before/after
preview placement relative to that active target. For sortable groups, the
registry may narrow measured candidates to relevant sortable item, neighbor, or
container entries before the targeting algorithm runs; the algorithm still makes
the active-target decision from that narrowed measured list.

## Modifiers

Modifiers transform pointer movement before drag state updates. Built-ins:

- `lockToXAxis()`
- `lockToYAxis()`
- `restrictToContainer(resolver)`

`restrictToContainer` receives a resolver function with
`DragModifierSetupInput` and returns an `HTMLElement | null`.

Custom modifiers can provide:

- `setup(input)`: optional setup state for the active drag
- `transform(input)`: returns the next `DragPoint`

Modifier input includes `draggableId`, `group`, source rect, initial pointer
position, raw pointer position, current pointer position, overlay rect, and
modifier state.

## Measurement

Targets are measured when registered and remeasured at drag start. The explicit
target remeasurement entry point is `controller.remeasureDropTargets(input?)`;
call it when app-owned layout changes during a drag should affect targeting.

Overlay measurement is separate from target measurement. Overlay content is
measured on mount/replacement and by `ResizeObserver` when available. Use
`controller.remeasureOverlay()` when the current overlay geometry should be
refreshed manually, such as after an app-owned transition or transform that
changes visual bounds without a normal size-observer notification.

`RemeasureDropTargetsInput` accepts:

- no argument for all targets
- a target id string
- an array of target id strings
- `{ group: string }`

Sortable preview movement does not automatically remeasure a group. Targeting
continues from the runtime's cached target rects until the app explicitly
remeasures. Final sortable placement is derived from the current preview DOM
order, so app-owned layout changes such as expanding tree rows or changing
grouped sections during a drag should call the public remeasure API when those
changes need to affect targeting.

## Data Ownership

The DOM package never owns application data. Item ids, target ids, group ids,
and container ids are identifiers that your app maps to its own model.

Commit data in lifecycle callbacks, usually `onDrop`. Rerender or patch the DOM
using your app's normal rendering path after the commit.

## Lifetime Model

Root binding helpers do not return per-item disposers. Runtime/controller
objects are ordinary JavaScript objects and are released by garbage collection
when unreachable.

DOM registrations are a separate lifetime. Bindings keep WeakRef-backed records,
and disconnected drop targets/sortables are pruned on drag-critical paths and
explicit remeasurement. Active drag resources are owned by the input drag
lifecycle and are released on drop, cancel, and pointercancel.

Pending pointer activation is also separate from an active drag. Activation
delay timers, the pending activation state, and the latest pre-activation
pointer position are canceled by pointerup, pointercancel, activation success,
activation failure, or active drag reset.

Active drag resources include pointer/window listeners, keyboard listeners, RAF
pointer updates, text-selection suppression, active target/session state,
overlay host state, active modifiers, and sortable preview/snapshot state. They
are released by active drag lifecycle paths. Runtime disposal is not the cleanup
mechanism for those resources.

Sortable registration state and sortable active preview state are separate.
Registered sortable elements, ids, groups, containers, and options remain until
they are unregistered or pruned as stale DOM. Per-drag sortable snapshots,
dragged attributes, preview placement, and moved DOM are restored by active drag
cleanup.

## Accessibility Scope

Keyboard dragging is available when `keyboardConfiguration.enabled` is not
disabled. Defaults use Space or Enter to start/drop, Escape to cancel, arrow
keys to move, and a default movement distance of 24.

Draggable or sortable elements may receive `tabIndex` and keyboard handlers
when keyboard dragging is enabled. Drag handles and focusable draggable elements
should have clear labels.

Announcements are opt-in through `announcements`. The controller creates a
polite live region only when announcement callbacks are provided. The package
does not claim complete screen-reader drag-and-drop support; apps should provide
domain-specific instructions and announcements for their interaction model.
The lifecycle `onDragUpdate` callback runs for drag updates; the announcement
`onDragUpdate` callback is intended for active-drop-target transitions and
dedupes repeated messages to avoid live-region spam. Use lifecycle
`onDragUpdate` for per-frame side effects, not announcements.

## Example

```ts
import {
  createDragController,
  createDraggable,
  createDroppable,
} from "@mk-drag-and-drop/dom";

const state = {
  itemLocation: "todo",
};

const controller = createDragController({
  onDrop({ draggableId, dropTargetId }) {
    state.itemLocation = dropTargetId;
    console.log(`${draggableId} moved to ${dropTargetId}`);
  },
});

const item = document.createElement("button");
item.type = "button";
item.textContent = "Drag me";

createDraggable({
  controller,
  element: item,
  draggableId: "task-1",
});

for (const columnId of ["todo", "done"]) {
  const column = document.createElement("section");

  createDroppable({
    controller,
    element: column,
    dropTargetId: columnId,
  });

  document.body.append(column);
}

document.body.append(item);
```

## Examples

Vanilla DOM examples live in `apps/web/src/vanilla`:

- `basicDrag.ts`
- `dropzoneList.ts`
- `sortableList.ts`
- `kanbanExample.ts`
- `groupedExample.ts`
- `treeExample.ts`

They use root imports from `@mk-drag-and-drop/dom`.

## Development

```bash
pnpm --filter @mk-drag-and-drop/dom build
pnpm --filter @mk-drag-and-drop/dom lint
pnpm --filter @mk-drag-and-drop/dom test
```

Example app verification:

```bash
pnpm --filter web build
```
