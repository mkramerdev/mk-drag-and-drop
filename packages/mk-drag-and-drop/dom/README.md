# @mk-drag-and-drop/dom

Headless DOM drag-and-drop primitives for draggable, droppable, sortable, and
grouped interactions. The package owns input, target measurement and selection,
modifiers, overlays, transient sortable DOM preview, normalization, and
lifecycle sequencing. Applications own their canonical data and commits.

## Imports

Use `@mk-drag-and-drop/dom` for application code:

```ts
import {
  createDragController,
  createDragHandle,
  createDraggable,
  createDropContainer,
  createDroppable,
  createSortable,
  domPointerDragActiveAttribute,
  type DragUpdateEvent,
  type SortableDropPlacement,
  type SortablePreview,
} from "@mk-drag-and-drop/dom";
```

`@mk-drag-and-drop/dom/integration` is the intentional adapter entry point. It
exports `createDragRuntimeScope`, DOM behavior factories, subscription and
active-reset types, and related behavior types. Registries, sortable
coordinators, and deep source/build paths are not public.

## Controller and bindings

```ts
const controller = createDragController({
  pointerConfiguration: {
    activationDelay: 180,
    activationDistance: 6,
  },
  onDragUpdate(event) {
    routePreview(event.group, event.sortablePreview);
  },
  onDrop(event) {
    commitDrop(event);
  },
});

createSortable({
  controller,
  element,
  draggableId: "row-1",
  group: "table-rows",
  axis: "vertical",
});
```

The public controller methods are:

- `cancelDrag()`
- `remeasureDropTargets(input?)`
- `remeasureOverlay()`
- `recomputeActiveDrag()`

Bindings return `void`; their connected-element registrations are scope owned.
Call `cancelDrag()` before a Vanilla owner removes its registered DOM. It is an
idle-safe no-op, cancels pending activation or an active pointer/keyboard drag,
restores sortable preview DOM, and never produces a drop.

## Lifecycle types

```ts
export type SortablePreview =
  | { status: "inactive" }
  | { status: "source"; placement: SortableDropPlacement }
  | { status: "projected"; placement: SortableDropPlacement };

export type DragStartEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  pointerPosition: DragPoint;
  sourceRect: DragRect;
};

export type DragUpdateEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  activeDropTargetId: string | null;
  previousDropTargetId: string | null;
  sortablePreview: SortablePreview;
};

export type DragEndEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  result: DragEndResult;
  overlayRect: DragRect | null;
  dropTargetId: string | null;
};

export type DropEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  dropTargetId: string;
  sortablePlacement?: SortableDropPlacement;
};

export type ActiveDragResetEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
};
```

`DragSource` is `"pointer" | "keyboard"`. `DragEndResult` is `"dropped" |
"no-target" | "invalid-target" | "canceled"`.

The group is captured when activation succeeds and remains stable through every
event and announcement. Re-registering the source with another group may
invalidate it, but cannot change the session group.

## Live sortable preview

`sortablePreview` is included in every normal drag update.

| Status      | Exact meaning                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inactive`  | The source is a plain draggable or is no longer a connected, valid sortable registration in the captured group. It does not merely mean there is no active target.                                                          |
| `source`    | The normalized package-owned preview equals the source container and sibling anchors captured at activation. This includes initial position, no target before movement, valid no-op, and a return to the original location. |
| `projected` | The normalized preview differs from source. This includes same- or cross-container movement, container-only placement, and a moved preview retained after the pointer leaves valid targets.                                 |

A source placement describes the captured source container and adjacent sortable
siblings; `targetDraggableId` and `side` are `null`. Container-only projected
placement also has null target/side while its container and neighboring anchors
describe the location. Siblings from other groups and disconnected or replaced
registrations are excluded.

`SortableDropPlacement` is the sole placement payload for both live and final
placement:

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

## Sequencing and completion

The public update guarantee is:

```text
measure/select target
-> update package-owned sortable preview
-> normalize current preview
-> publish DragUpdateEvent
```

Public callbacks and adapter subscriptions receive a completed event after the
DOM mutation. Consumers must not inspect carrier DOM to reconstruct placement
or depend on subscription insertion order.

The drop guarantee is:

```text
flush final pointer update
-> validate target
-> capture normalized placement
-> restore package preview DOM
-> publish onDragEnd
-> publish onDrop for a valid drop
```

Live and drop placement use the same normalizer, so a projected drop with no
intervening update equals the last projected placement. A successful source/no-
op drop omits `sortablePlacement`. Package-owned carrier DOM is restored before
public end/drop handlers. Cancellation emits no artificial final update;
`onDragEnd` ends application projection. An invalid target yields
`invalid-target` and no `onDrop`, and its disconnected id is not retained as a
normalized anchor.

## Applying placement

Apply the package decision to application ids; do not calculate geometry,
midpoints, direction, hysteresis, or candidates:

```ts
function getProjectedOrder(
  canonicalOrder: readonly string[],
  event: DragUpdateEvent,
): readonly string[] {
  if (event.sortablePreview.status === "inactive") return canonicalOrder;
  if (event.sortablePreview.status === "source") return canonicalOrder;

  return applySortablePlacement(
    canonicalOrder,
    event.draggableId,
    event.sortablePreview.placement,
  );
}
```

Canonical state remains unchanged during updates. Commit it once from
`onDrop`. Since `onDragEnd` runs first, keep a successful projection until
`onDrop` commits; clear it immediately for cancellation, no-target, and invalid
target.

## Groups

Groups isolate target interaction and route lifecycle work:

```ts
const controller = createDragController({
  onDragUpdate(event) {
    switch (event.group) {
      case "document-blocks":
        break;
      case "table-rows":
        break;
      case "table-columns":
        break;
    }
  },
});
```

Use one controller when those domains belong to one scope. Do not encode the
domain in `draggableId`.

## Remeasure and recompute

After scrolling or application layout changes:

```ts
controller.remeasureDropTargets({ group: "table-columns" });
controller.recomputeActiveDrag();
```

Remeasurement refreshes cached geometry and publishes nothing. Recompute reuses
the last raw pointer position, reapplies modifiers, and runs the same target,
preview, normalization, and publication path. It does not implicitly
remeasure. Schedule after visible projection reaches the DOM, compare orders,
and deduplicate the scheduled work to prevent loops.

## Pointer and keyboard handles

### Mobile pointer ownership

Dedicated drag handles must declare touch gesture ownership before a gesture
begins. `createDragHandle` adds the stable `data-dnd-drag-handle` attribute;
apply the following CSS in every document or shadow root that renders handles:

```css
[data-dnd-drag-handle] {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
```

`touch-action` cannot be applied from `pointerdown`: the browser decides native
pan/zoom ownership before the handler runs. The runtime uses pointer capture
after activation and suppresses standard and WebKit text selection during both
pending and active pointer input, but neither mechanism replaces the CSS
contract.

For a draggable without a dedicated handle, apply `touch-action` to the
draggable surface only when that surface should own touch movement. `none`
prevents ordinary page scrolling from gestures that begin there. An
axis-specific value can preserve orthogonal native panning, but a vertical drag
and vertical page scroll cannot own the same gesture simultaneously. Scrolling
outside dedicated handles remains unaffected.

`activationDelay` and `activationDistance` use OR semantics: either threshold
activates. Quick release before activation remains an ordinary click. After an
activated pointer drag, the browser click belonging to that interaction and
targeting the initiating draggable subtree is suppressed once; later unrelated,
programmatic, and keyboard clicks remain available.

`createDragHandle({ element })` marks a descendant handle. A button may be a
pointer handle, but Space and Enter are reserved for its button/menu behavior;
interactive-element protection prevents those keys from starting a drag. Use a
noninteractive or separately focusable handle, or explicit commands, for
keyboard sorting. Editable descendants remain protected.

### Active pointer cursor state

When a pointer drag activates, the runtime sets the stable
`data-dnd-pointer-drag-active="true"` contract on the initiating document's
root element. Pending delay or distance activation and keyboard dragging do not
set it. The marker is removed when the actual drag ends, before lifecycle
completion and before any manual overlay release animation finishes.

The package does not choose or inject a cursor. Applications can opt into one:

```css
:root[data-dnd-pointer-drag-active="true"],
:root[data-dnd-pointer-drag-active="true"] *,
:root[data-dnd-pointer-drag-active="true"] *::before,
:root[data-dnd-pointer-drag-active="true"] *::after {
  cursor: grabbing !important;
}
```

The descendant selectors and `!important` override explicit application
cursors such as `text`, `pointer`, or `col-resize`. Add equivalent rules inside
shadow roots when shadow content declares its own cursor. Each iframe document
also needs its own consumer stylesheet. The exported
`domPointerDragActiveAttribute` constant contains the supported attribute name
for JavaScript and CSS-in-JS integrations.

## Targeting and overlays

Pointer-based targeting works without an overlay. `centerToCenter` and other
rect-based targeting need a measurable overlay rectangle. A configured overlay
callback receives `dragState.group`, enabling real blank elements sized for row
or column carriers:

```ts
const controller = createDragController({
  dragOverlay({ dragState }) {
    const overlay = document.createElement("div");
    overlay.className =
      dragState.group === "table-rows" ? "rowOverlay" : "columnOverlay";
    return overlay;
  },
});
```

The wrapper is pointer-inert. The source rect comes from the registered carrier,
not a thin descendant handle, and is translated until overlay measurement is
available. Returning `null` from a configured callback is not a measurable blank
overlay. Sortable behavior itself does not require any overlay.

Built-in targeting algorithms are `pointerToCenter`, `pointerToRectDistance`,
and `centerToCenter`. Sortable `placementBoundary` controls same-target reversal
hysteresis; it does not select the active target.

## Integration entry point

Adapter code may import:

```ts
import {
  createDragRuntimeScope,
  createDomSortable,
  type ActiveDragResetEvent,
  type DragRuntimeSubscription,
} from "@mk-drag-and-drop/dom/integration";
```

Subscribers observe completed lifecycle events and are not responsible for
sortable processing. The integration entry point does not expose mutable
registries or the internal sortable coordinator.

## Carrier table

The complete carrier architecture and runnable Vanilla/React examples are
documented in the repository carrier-table guide. Carriers stay connected,
contain no table content, match logical row/column geometry, and reflow as
normal-flow children of absolute overlay lanes. `sortablePreview` drives the
visible table; `sortablePlacement` performs one canonical drop commit.
