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
who need lower-level DOM behavior factories and a runtime handle. Deep imports
into `src` or `dist` files are not part of the public package exports.

## Public Root API

The root export includes:

- `createDragController`
- `createDraggable`
- `createDroppable`
- `createDropContainer`
- `createSortable`
- `createDragHandle`
- lifecycle types: `DragStartEvent`, `DragUpdateEvent`, `DragEndEvent`,
  `DropEvent`, `DragSource`, `DragEndResult`, `DragLifecycleCallbacks`,
  `DragLifecycleHelpers`
- placement types: `SortableDropPlacement`, `RemeasureDropTargetsInput`
- targeting helpers and types: `pointerToCenter`, `centerToCenter`,
  `pointerToRectDistance`, `getDistanceToRect`, `maxDistanceToRect`,
  `DropTarget`, `TargetingAlgorithm`, `TargetingAlgorithmInput`,
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

- `createDragRuntimeHandle`
- `DragRuntimeHandle`, `DragRuntimeHandleOptions`,
  `DragRuntimeHandleConfigureInput`
- `DragState`, `DragOverlayPhase`, `DragOverlayRenderState`
- `DragRuntimeSubscription`
- `createDomDraggable`, `createDomDroppable`, `createDomDropContainer`,
  `createDomSortable`
- the related DOM behavior/input/runtime types
- `domDragHandleAttribute`

Use this subpath when building a framework adapter or custom behavior layer. For
ordinary DOM usage, prefer the root controller and binding helpers.

## Controller

`createDragController(options?)` creates the public DOM controller used by the
root binding helpers. Controller options include:

- lifecycle callbacks: `onDragStart`, `onDragUpdate`, `onDragEnd`, `onDrop`
- `announcements`: lifecycle callbacks that return polite live-region text
- `dragOverlay(input)`: returns an overlay `HTMLElement` or `null`
- `overlayRoot`: optional root for the DOM overlay wrapper
- `keepOverlayOnDrop`: keeps the overlay in the `"released"` phase until
  `finishOverlay` or the overlay input `finish` callback removes it
- `targetingAlgorithm` and `targetingConstraint`
- `modifiers`
- `pointerConfiguration`
- `keyboardConfiguration`

The returned controller has:

- `update(options)`: replaces runtime/controller configuration
- `remeasureDropTargets(input?)`: remeasures all targets, one target id, an
  array of target ids, or `{ group }`
- `cleanup()`: ends active drag resources and removes the current overlay
- `dispose()`: final teardown for the controller, runtime registrations,
  subscriptions, overlays, live region, and registered dispose callbacks
- `finishOverlay()`: removes a kept overlay

## Drag Overlays

`dragOverlay(input)` is a creation hook. The controller calls it when overlay
content is mounted for the `"dragging"` phase, and once more for the
`"released"` phase when `keepOverlayOnDrop` is enabled. Pointer movement does
not call `dragOverlay`.

Apps own the returned overlay element and any dynamic content inside it. The
package owns the overlay wrapper, movement, cleanup, and geometry measurement
used by targeting and modifiers. The wrapper is positioned with `position:
fixed`, source rect dimensions, `pointer-events: none`, and a transform derived
from the current pointer delta.

The controller measures the returned overlay element on mount/replacement. When
`ResizeObserver` is available, it also remeasures when that element changes
size. The runtime derives the current overlay rect from that cached measurement
plus pointer movement.

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
};
```

Helpers:

- `getDropTargetRect(dropTargetId)`

`onDrop` only runs for a valid successful drop. `onDragEnd` runs whenever a drag
ends. `result: "dropped"` means a valid target was accepted and `onDrop` also
runs. `result: "no-target"` means the user ended normally with no active target.
`result: "invalid-target"` means an active target candidate was stale by finish
time. `result: "canceled"` means the drag was canceled, such as Escape,
pointercancel, or runtime cancellation.

## Bindings

Root binding helpers attach behavior to DOM elements and return `void`.
Registrations and listeners are tied to the controller lifetime.

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
};
```

No sortable placement is included for plain droppable drops. No-op sortable drops
may omit `sortablePlacement`.

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
- `maxDistanceToRect({ maxDistance?, maxXDistance?, maxYDistance? })`

Custom `TargetingAlgorithm` functions receive `pointerPosition`, `overlayRect`,
and the filtered `dropTargets` list. Custom `TargetingConstraint` functions
receive `pointerPosition`, `overlayRect`, and one `dropTarget`, and return
whether that candidate is eligible.

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

Targets are measured when registered and remeasured at drag start. Call
`controller.remeasureDropTargets()` when layout changes during a drag.

`RemeasureDropTargetsInput` accepts:

- no argument for all targets
- a target id string
- an array of target id strings
- `{ group: string }`

Sortable previews may cause internal remeasurement after preview movement. Apps
should still call the public remeasure API for app-owned layout changes such as
expanding tree rows or changing grouped sections during a drag.

## Data Ownership

The DOM package never owns application data. Item ids, target ids, group ids,
and container ids are identifiers that your app maps to its own model.

Commit data in lifecycle callbacks, usually `onDrop`. Rerender or patch the DOM
using your app's normal rendering path after the commit.

## Cleanup Model

Root binding helpers do not return per-item disposers. Dispose the controller
when tearing down the view or application area that owns those bindings.

Use:

- `controller.cleanup()` to end active drag work and remove the active overlay
- `controller.dispose()` for final teardown

Disconnected drop targets are pruned on drag-critical paths, and dispose clears
runtime registrations. React users usually rely on `DragProvider` and hooks for
runtime and binding lifetime.

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
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
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
