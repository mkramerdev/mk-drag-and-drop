# @mk-drag-and-drop/react

## What It Is

`@mk-drag-and-drop/react` is the React adapter for the DOM-first
`@mk-drag-and-drop/dom` drag-and-drop runtime. It provides React hooks and a
provider for wiring rendered DOM nodes into the shared runtime.

The package is headless. It is not a component library, and it does not own your
markup, styling, data model, rendering strategy, or persistence. It provides
behavior, registration, targeting, lifecycle information, overlays, modifiers,
and placement data. Your app decides what the UI looks like and how a completed
drop changes application data.

The React package supports draggable items, droppable targets, sortable
lists and boards, drag handles, drop containers, drag overlays, modifiers,
targeting configuration, keyboard and pointer configuration, lifecycle
callbacks, and optional announcements.

## Relationship To The DOM Package

The React package wraps `@mk-drag-and-drop/dom`.

`DragProvider` creates and configures the DOM runtime through the package
integration scope.
Hooks such as `useDraggable`, `useDroppable`, `useSortable`, and
`useDropContainer` register DOM nodes with that runtime through React refs.
React hooks are adapters over DOM behavior, not a separate implementation.

Consumers should import React APIs from the package root,
`@mk-drag-and-drop/react`. The React package does not expose public subpath
exports. It uses `@mk-drag-and-drop/dom/integration` internally for lower-level
DOM behavior wiring.

Deep imports into package `src` or `dist` files are not part of the public
package exports.

The vanilla and React examples use the same underlying behavior. React users can
use the React package for provider and ref integration. Users who are not
rendering with React, or who are building another framework adapter, can use
`@mk-drag-and-drop/dom` directly.

## Public Root API

The React root export includes:

- `DragProvider`, `DragProviderProps`, `DragAnnouncements`
- `DragOverlayInput`
- `useDraggable`, `UseDraggableOptions`, `UseDraggableResult`
- `useDroppable`, `UseDroppableOptions`, `UseDroppableResult`
- `useDropContainer`, `UseDropContainerOptions`, `UseDropContainerResult`
- `useSortable`, `UseSortableOptions`, `UseSortableResult`
- `useDragHandle`, `UseDragHandleResult`
- `useRemeasureDropTargets`
- `useRecomputeActiveDrag`
- `useRemeasureOverlay`
- `composeRefs`
- React-friendly `restrictToContainer`, `ReactRestrictToContainerInput`
- DOM targeting helpers, modifier helpers, lifecycle/source/result types,
  sortable placement types, keyboard/pointer configuration types, and geometry
  types re-exported from the DOM package
- `OverlayReleaseMode`
- `DragState` and `DragOverlayPhase` from the DOM integration layer

## Core Mental Model

1. Wrap the interactive area in `DragProvider`.
2. Register drag sources with `useDraggable` or `useSortable`.
3. Register drop targets with `useDroppable` or `useDropContainer`.
4. Optionally attach `useDragHandle` to a handle element.
5. Use lifecycle callbacks, especially `onDrop`, to update app data.
6. Render the result however your app wants.

The package reports drag/drop operations. Your app owns the data and the final
UI commit. React state is one common way to commit the result, but it is not
required by the package.

## Lifetime Model

`DragProvider` is a drag-and-drop scope for a React subtree. It does not expose
runtime lifecycle controls, and application code does not dispose of the
runtime. The internal runtime is normal JavaScript memory and is released by
garbage collection when unreachable.

Hooks are adapters over the DOM behavior layer. They register committed DOM
nodes through refs/effects, update those registrations when ids, groups, or
container ids change, and unregister current nodes on ref/effect unmount.
Stale disconnected DOM registrations are still pruned by the shared DOM runtime
while the scope remains alive.

Pending pointer activation resources and active drag resources belong to the
input/drag lifecycle. Provider unmount releases active resources through the
same active-drag resource path used by DOM drag cancellation; it is not a
terminal runtime destructor. React StrictMode replay is supported for
draggable, droppable, sortable, overlay, callback, and announcement behavior.

## Installation

Install the React and DOM packages from your workspace or package registry:

- `@mk-drag-and-drop/react`
- `@mk-drag-and-drop/dom`

`react` is a peer dependency of the React package.

## Quick Start

```tsx
import { useState, type ReactNode } from "react";
import {
  DragProvider,
  useDragHandle,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react";

type Location = "left" | "right";

export function Example() {
  const [location, setLocation] = useState<Location>("left");

  return (
    <DragProvider
      onDrop={({ draggableId, dropTargetId }) => {
        if (
          draggableId === "card" &&
          (dropTargetId === "left" || dropTargetId === "right")
        ) {
          setLocation(dropTargetId);
        }
      }}
    >
      <div>
        <DropZone dropTargetId="left">
          {location === "left" ? <Card /> : null}
        </DropZone>
        <DropZone dropTargetId="right">
          {location === "right" ? <Card /> : null}
        </DropZone>
      </div>
    </DragProvider>
  );
}

function Card() {
  const draggable = useDraggable({ draggableId: "card", group: "demo" });
  const dragHandle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...draggable}>
      <button {...dragHandle} type="button" aria-label="Drag card">
        Drag
      </button>
      <span>Card</span>
    </div>
  );
}

function DropZone({
  dropTargetId,
  children,
}: {
  dropTargetId: Location;
  children: ReactNode;
}) {
  const droppable = useDroppable({ dropTargetId, group: "demo" });

  return <div {...droppable}>{children}</div>;
}
```

Real apps own the markup, layout, styling, state updates, and persistence.

## DragProvider

`DragProvider` creates a DOM runtime scope for the React subtree, configures it
from props, exposes it through React context, and renders an optional drag
overlay. Provider effect cleanup is not a runtime destructor; runtime objects
are ordinary JavaScript objects and active drag resources are released by drag
drop/cancel paths.

Key props:

- `onDragStart(event, helpers)`: called when a drag starts.
- `onDragUpdate(event, helpers)`: called for drag updates.
- `onDragEnd(event, helpers)`: called when dragging ends, with or without a
  valid drop.
- `onDrop(event, helpers)`: called when an item is dropped on a valid target.
- `dragOverlay(input)`: creates the visual overlay for the active drag.
- `targetingAlgorithm`: chooses one target from the measured targets.
- `targetingConstraint`: filters measured targets before targeting runs.
- `modifiers`: transforms pointer movement, such as axis locking or bounds.
- `pointerConfiguration`: configures pointer activation delay and distance.
- `keyboardConfiguration`: enables and configures keyboard drag commands.
- `announcements`: optional callbacks that return live-region messages.
- `overlayRelease`: `"auto"` removes overlays on drag end; `"manual"` keeps a
  released overlay until its `removeOverlay` callback is called.

Callbacks receive operation information and helper methods from the runtime.
Use those callbacks to commit app data. Do not mutate package internals.

## Lifecycle Events

`DragProvider` lifecycle callbacks and `announcements` callbacks receive these
event shapes:

```ts
type DragSource = "pointer" | "keyboard";

type DragEndResult =
  | "dropped"
  | "no-target"
  | "invalid-target"
  | "canceled";

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
```

`DragUpdateEvent.overlayRect` is the current viewport-space rectangle for the
drag overlay. `DragEndEvent.overlayRect` is the final viewport-space rectangle
at the moment the drag ends. React receives these DOM lifecycle event types
unchanged. The field is `null` when no drag overlay is configured. When an
overlay exists, it is based on cached overlay measurement plus modified pointer
movement, with the translated source rect as the fallback before overlay content
has been measured. React does not add overlay DOM measurement on every pointer
move.

`onDrop` only runs for a valid successful drop. `onDragEnd.result` distinguishes
successful drops, normal releases with no target, stale/invalid targets, and
cancellations such as Escape or pointercancel. Plain drops are id-only.
Sortable drops may include `event.sortablePlacement`; apps still own the data
commit.

## Hooks

Hook result types are generic over the host element type and default to
`HTMLElement`. Specify a narrower element type when you want element-specific
ref and attribute typing; the hooks are not limited to `div` elements.

### useDraggable

`useDraggable` registers an item as a drag source.

```tsx
const draggable = useDraggable({
  draggableId: "card-1",
  group: "cards",
});

return <div {...draggable}>Card</div>;
```

Options:

- `draggableId`: stable string identifier for the dragged item.
- `group`: optional drag group. Defaults to `"default"`.

Return shape:

- `ref`: attaches the rendered element to the runtime.
- `onPointerDown`: starts pointer activation when allowed.
- `tabIndex` and `onKeyDown`: included when keyboard dragging is enabled.

Use `useDragHandle` when dragging should start only from a specific handle.

### useDroppable

`useDroppable` registers a DOM node as a valid drop target.

```tsx
const droppable = useDroppable({
  dropTargetId: "archive",
  group: "cards",
});

return <div {...droppable} />;
```

Options:

- `dropTargetId`: stable string identifier for the target.
- `group`: optional drag group. Only items in the same group target it.
- `containerId`: optional container identity for placement-aware behavior.

Use droppable targets for custom drop zones, tree rows, grouped rows, insertion
lines, and other app-defined target geometry.

### useSortable

`useSortable` combines draggable behavior and drop-target behavior for sortable
items.

```tsx
const sortable = useSortable<HTMLArticleElement>({
  draggableId: item.id,
  group: "cards",
  containerId: column.id,
});

return <article {...sortable}>{item.title}</article>;
```

Options:

- `draggableId`: stable string identifier for the sortable item.
- `group`: optional drag group. Defaults to `"default"`.
- `containerId`: optional container identity for lists, boards, and columns.

Return shape:

- `ref`: attaches and registers the sortable element.
- `onPointerDown`: starts pointer activation when allowed.
- `tabIndex` and `onKeyDown`: included when keyboard dragging is enabled.

During drag, the runtime may temporarily move sortable DOM nodes to preview
placement. That preview is transient. It does not commit application order.
On drop, read `event.sortablePlacement` and update your own data. Plain
droppable drops do not include sortable placement.

### useDropContainer

`useDropContainer` registers a container for placement-aware sortable/drop
behavior.

```tsx
const container = useDropContainer({
  containerId: "backlog",
  group: "cards",
});

return <div {...container}>{cards}</div>;
```

Use drop containers for boards, multiple lists, columns, and empty containers
that should accept items. A container does not imply orientation by itself.
Sortable placement is determined from the registered items' layout and the
targeting behavior.

### useDragHandle

`useDragHandle` marks an element as the drag handle for the nearest draggable or
sortable element.

```tsx
const handle = useDragHandle<HTMLButtonElement>();

return (
  <button {...handle} type="button" aria-label="Drag item">
    Drag
  </button>
);
```

When a draggable contains a handle, pointer dragging starts from the handle.
This helps keep other interactive children usable.

### useRemeasureDropTargets

`useRemeasureDropTargets` returns a function for explicitly remeasuring targets
after layout changes during a drag.

```tsx
const remeasureDropTargets = useRemeasureDropTargets();

requestAnimationFrame(() => {
  remeasureDropTargets({ group: "tree" });
});
```

It accepts no argument, a target id, an array of target ids, or `{ group }`.
Use it intentionally for expand/collapse, grouped trees, or drag-state layout
changes. It is not needed for normal resource release and should not run on
every render. Sortable preview movement does not automatically remeasure a
group; call this function when an app-owned layout change needs to affect
targeting.

### useRecomputeActiveDrag

`useRecomputeActiveDrag` returns a function for rerunning the active drag update
path from the last pointer position. It must be used inside `DragProvider` and
is a thin wrapper over the DOM runtime operation. It follows the same update
path as DOM pointer movement. Calling the returned function with no active drag
is safe and does nothing.

```tsx
const recomputeActiveDrag = useRecomputeActiveDrag();

recomputeActiveDrag();
```

Use it after external changes that require active targeting to run again without
a new pointer event. It does not remeasure drop targets. When target
measurements changed, call `useRemeasureDropTargets()` first.

```tsx
const remeasureDropTargets = useRemeasureDropTargets();
const recomputeActiveDrag = useRecomputeActiveDrag();

remeasureDropTargets({ group: "items" });
recomputeActiveDrag();
```

### useRemeasureOverlay

`useRemeasureOverlay` returns a function for manually refreshing the current
overlay measurement. It must be used inside `DragProvider`. Calling the returned
function with no mounted overlay is safe and does nothing.

```tsx
const remeasureOverlay = useRemeasureOverlay();

remeasureOverlay();
```

Normal overlay size changes are observed automatically with `ResizeObserver`
when available. Use this hook when the app knows visual geometry changed outside
that automatic path, such as after a CSS transform or transition.

## Sortable Behavior

Sortable preview is transient. The runtime may move DOM temporarily to show
where an item would land, then restore or clear that preview as the drag ends.
Preview movement does not trigger full target remeasurement. The app still
commits data on drop, using placement derived from the current preview DOM
order. React rendering should then reflect the final data.

React uses the DOM package placement rules. Same-container sortable preview
keeps its movement-responsive first-placement behavior: forward movement places
after a newly active target, backward movement places before, and no
sortable-axis movement uses the target midpoint. When a sortable item first
enters a different DOM container, the initial side is based on the target
midpoint on the sortable axis: above or left of midpoint places before, while
below or right of midpoint places after. `placementBoundary` remains a
same-target reversal and hysteresis control after preview placement exists; it
does not decide the initial side for cross-container sortable entry.

Examples may rerender a full list for simplicity, but granular state management,
external stores, server commits, and imperative rendering strategies are
compatible. The package does not require React state.

```tsx
<DragProvider
  onDrop={({ draggableId, sortablePlacement }) => {
    const placement = sortablePlacement;

    if (!placement) {
      return;
    }

    setItems((items) => reorderData(items, draggableId, placement));
  }}
>
  {/* sortable items */}
</DragProvider>
```

`reorderData` is app code. It should translate `draggableId`,
`placement.containerId`, `placement.targetDraggableId`, `placement.side`,
`placement.previousDraggableId`, and `placement.nextDraggableId` into your data
shape.

## Drag Overlays

`dragOverlay` creates a visual representation during drag.

```tsx
<DragProvider
  dragOverlay={({ dragState, remeasureOverlay }) => (
    <div className="dragOverlay" onTransitionEnd={remeasureOverlay}>
      {dragState.draggableId}
    </div>
  )}
>
  {children}
</DragProvider>
```

The overlay input includes:

- `dragState`: item id, group, source rect, start pointer, and current pointer.
- `phase`: `"dragging"` or `"released"`.
- `remeasureOverlay`: manually refreshes the cached overlay measurement.
- `removeOverlay`: present only for `"released"` overlays in manual release
  mode; call it when app-owned release animation should remove the overlay.

Overlay rendering is app-owned. `DragProvider` mounts overlay content for the
dragging phase. Default `overlayRelease: "auto"` removes the overlay
immediately on drag end. Manual release replaces it once for the released phase
and leaves removal to `removeOverlay`. Pointer movement updates the
package-owned overlay host imperatively and does not call `dragOverlay` by
default.

`removeOverlay` is idempotent and belongs to overlay release only. It is not a
provider, controller, or runtime teardown API.

The package owns overlay hosting, movement, release, and measurement for
targeting and modifiers. It measures overlay content on mount/replacement and
uses `ResizeObserver` when available to remeasure content size changes. The
React package mirrors DOM behavior: overlay movement remains package-managed and
imperative, so pointer movement should not require React state updates on every
move.

Use the overlay input `remeasureOverlay` helper when overlay-local UI knows its
visual bounds changed. It uses the same provider/runtime path as
`useRemeasureOverlay` and avoids reaching into internal runtime or provider
state. CSS transforms can change visual bounds without necessarily triggering
`ResizeObserver`.

Dynamic overlay content should use overlay-local state, component effects,
lifecycle callbacks feeding a subscription/external store, or another app-owned
update path rather than relying on `dragOverlay` being called for every pointer
move.

## Targeting And Modifiers

Targeting algorithms choose among measured drop targets. Targeting constraints
filter targets before an algorithm runs. Modifiers transform movement during a
drag.

Custom targeting algorithms receive `pointerPosition`, `overlayRect`, and
measured targets. Constraints receive `pointerPosition`, `overlayRect`, and one
candidate target. Algorithms and constraints choose their own geometry:
pointer helpers use the pointer position, while `centerToCenter` computes the
overlay center from `overlayRect`.

The React package re-exports targeting helpers such as `pointerToCenter`,
`centerToCenter`, `pointerToRectDistance`, `getDistanceToRect`, and
`maxPointerDistanceToRect` / `maxOverlayCenterDistanceToRect`, plus modifier
helpers. Sortable placement remains separate from targeting: the configured
targeting algorithm chooses the active target, and sortable only chooses
before/after placement relative to that target. For sortable groups, the shared
DOM registry may narrow measured candidates to relevant sortable item, neighbor,
or container entries before the targeting algorithm runs; the algorithm still
chooses from that narrowed measured list.

The before/after side follows the DOM package sortable placement behavior
described above, including midpoint initial placement for cross-container entry
and `placementBoundary` for later same-target reversal behavior.

- `lockToXAxis()`
- `lockToYAxis()`
- `restrictToContainer(refOrResolver)`

`restrictToContainer` accepts either a React ref object or a resolver function.
Use the DOM package directly when you are building non-React integrations or
imperative DOM behavior.

### Memoize Modifiers And Composed Refs

Modifier factories such as `restrictToContainer(...)` return modifier objects.
When passing modifiers to `DragProvider`, create the array with `useMemo` so the
runtime is not reconfigured with a new array every render.

`composeRefs(...)` returns a ref callback. When the composed ref is used on a
registered draggable, droppable, sortable, or drop container element, memoize it
with `useMemo` so React does not clear and reassign the ref on every render.

```tsx
const modifiers = useMemo(
  () => [restrictToContainer(containerRef)],
  [],
);

const combinedRef = useMemo(
  () => composeRefs(localRef, droppable.ref),
  [droppable.ref],
);
```

Custom targeting algorithms receive `pointerPosition`, `overlayRect`, and a
list of measured `dropTargets`. Each target has `dropTargetId` and
`dropTargetRect`. Custom constraints receive one candidate `dropTarget` and
return whether it should be eligible.

## Accessibility

The runtime has keyboard dragging support through `keyboardConfiguration`.
When keyboard dragging is enabled, draggable and sortable hooks add keyboard
props to registered elements.

Accessibility still depends on the app's markup and product behavior:

- Prefer button or focusable drag handles with clear labels.
- Do not hijack editable controls or unrelated interactive children.
- Provide domain-specific instructions for what dragging does.
- Use `announcements` when you want the provider to render polite live-region
  updates from lifecycle callbacks. `announcements.onDragUpdate` runs for
  active-drop-target transitions and dedupes repeated messages to avoid
  live-region spam and provider rerenders; use lifecycle `onDragUpdate` for
  per-frame side effects.
- Do not assume this package alone provides complete screen-reader drag-and-drop
  support for your domain.

## Lifetime And Effects

Hooks attach input props and register DOM nodes through refs and lifecycle
effects. Users should not manually release runtime entries for normal React
mount/unmount.

`DragProvider` does not call a terminal runtime destructor when it unmounts.
`useDropContainer` releases its current DOM registration from effect cleanup.
`useDraggable`, `useDroppable`, and `useSortable` rely on React prop/ref updates
for normal mount, unmount, and element replacement behavior.

`useRemeasureDropTargets`, `useRecomputeActiveDrag`, and `useRemeasureOverlay`
are for active drag geometry or targeting changes, not resource release. The
runtime also prunes disconnected targets on drag-critical paths such as
remeasurement.

## Examples

React examples live in `apps/react-web/src/react`:

- Basic drag: moves one item between two droppable containers with an overlay.
- Dropzone list: uses generated droppable insertion lines for list reordering.
- Sortable list: uses `useSortable` and commits order from sortable placement.
- Kanban: combines sortable columns, sortable cards, drop containers, overlays,
  and a container modifier.
- Grouped drag and drop: mixes parent sorting, child dragging, custom targets,
  expansion state, and explicit remeasurement.
- Tree: uses app-defined tree projection, generated targets, custom targeting,
  and app-owned hierarchy updates.

## API Reference

- `DragProvider`: creates/configures the DOM runtime for a React subtree.
  Important props include lifecycle callbacks, overlay rendering, targeting,
  constraints, modifiers, pointer/keyboard configuration, announcements, and
  `overlayRelease`.
- `useDraggable(options)`: registers a drag source. Important options:
  `draggableId`, `group`. Returns ref and input props.
- `useDroppable(options)`: registers a drop target. Important options:
  `dropTargetId`, `group`, `containerId`. Returns a ref prop.
- `useSortable(options)`: registers a sortable item as both source and target.
  Important options: `draggableId`, `group`, `containerId`. Returns ref and input
  props.
- `useDropContainer(options)`: registers a placement-aware container. Important
  options: `containerId`, `group`. Returns a ref prop.
- `useDragHandle()`: returns the handle attribute props for a handle element.
- `useRemeasureDropTargets()`: returns a function for remeasuring all targets,
  one target, multiple targets, or a group.
- `useRecomputeActiveDrag()`: returns a function for rerunning active targeting
  and drag update from the last pointer position without remeasuring targets.
- `useRemeasureOverlay()`: returns a function for manually refreshing the
  currently mounted overlay measurement.
- `composeRefs`: helper for combining the refs returned by hooks with app refs.
- `lockToXAxis`, `lockToYAxis`: DOM movement modifiers re-exported by React.
- `restrictToContainer`: React-friendly container-bound modifier.

Important event/helper types are re-exported from the React package, including
`DragStartEvent`, `DragUpdateEvent`, `DragEndEvent`, `DropEvent`,
`DragSource`, `DragEndResult`, `DragLifecycleHelpers`, `DragState`,
`DragOverlayPhase`, `SortableDropPlacement`, `RemeasureDropTargetsInput`,
`OverlayReleaseMode`, `PointerConfiguration`, `KeyboardConfiguration`,
`KeyboardCommand`, `DropTarget`, targeting types, geometry types, and modifier
types.

## When To Use DOM Directly

Use `@mk-drag-and-drop/dom` directly when:

- You are not using React.
- You are integrating with another rendering framework.
- You are managing DOM imperatively.
- You are building a lower-level adapter.

Use `@mk-drag-and-drop/react` when:

- Your UI is rendered with React.
- You want ref-based hooks for registration.
- You want provider-based runtime scoping and lifecycle integration.

## Development

Package scripts in this workspace:

```bash
pnpm --filter @mk-drag-and-drop/react... build
pnpm --filter @mk-drag-and-drop/react lint
pnpm --filter @mk-drag-and-drop/react test
pnpm --filter react-web build
```

The React example app also has `dev` and `preview` scripts, but they start local
Vite processes and are not required for package verification.
