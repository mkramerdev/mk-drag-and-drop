# mk-drag-and-drop

`mk-drag-and-drop` is a headless, DOM-first drag-and-drop library. The DOM
package owns input, measurement, targeting, overlays, modifiers, sortable DOM
preview, and lifecycle sequencing. The React package is a thin provider and
hook layer over the same public DOM types and runtime.

Applications own markup, visible projection, canonical data, and the single
final commit.

## Packages

- `@mk-drag-and-drop/dom` exposes the controller and DOM bindings. Adapter
  authors can also use its intentional `/integration` entry point.
- `@mk-drag-and-drop/react` exposes `DragProvider` and hooks, and re-exports the
  public DOM contract with one type identity.

```ts
import {
  createDragController,
  createDragHandle,
  createSortable,
  domPointerDragActiveAttribute,
  type DragUpdateEvent,
  type SortablePreview,
} from "@mk-drag-and-drop/dom";
```

```tsx
import {
  DragProvider,
  domPointerDragActiveAttribute,
  useDragHandle,
  useSortable,
  type DragUpdateEvent,
  type SortablePreview,
} from "@mk-drag-and-drop/react";
```

Deep imports into source, build output, registries, or runtime internals are not
public API.

## Lifecycle contract

Every lifecycle event carries the drag group captured when activation succeeds.
That group is immutable for the session, even if registrations change later.

```ts
type SortablePreview =
  | { status: "inactive" }
  | { status: "source"; placement: SortableDropPlacement }
  | { status: "projected"; placement: SortableDropPlacement };

type DragStartEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  pointerPosition: DragPoint;
  sourceRect: DragRect;
};

type DragUpdateEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  activeDropTargetId: string | null;
  previousDropTargetId: string | null;
  sortablePreview: SortablePreview;
};

type DragEndEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  result: "dropped" | "no-target" | "invalid-target" | "canceled";
  overlayRect: DragRect | null;
  dropTargetId: string | null;
};

type DropEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
  dropTargetId: string;
  sortablePlacement?: SortableDropPlacement;
};

type ActiveDragResetEvent = {
  draggableId: string;
  group: string;
  source: DragSource;
};
```

`sortablePreview` is present on every normal update:

| Status      | Meaning                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `inactive`  | The source is not a valid sortable registration in the captured group. A plain draggable is inactive.                           |
| `source`    | The normalized preview equals the captured source container and sibling anchors.                                                |
| `projected` | The normalized package preview differs from the captured source order, including retained movement after leaving valid targets. |

The package guarantees this conceptual update order:

```text
measure/select target
-> update package-owned sortable preview
-> normalize current preview
-> publish DragUpdateEvent
```

Drop uses the same normalizer:

```text
flush final pointer update
-> validate target
-> capture normalized placement
-> restore package preview DOM
-> publish drag end
-> publish successful drop
```

Consequently `onDragUpdate` sees completed preview DOM, and a projected
`DropEvent.sortablePlacement` deeply matches the last projected live placement
when no update intervenes. A successful source/no-op drop omits
`sortablePlacement`. Cancellation emits no artificial final update; consumers
end projection in `onDragEnd`. Invalid release reports `invalid-target` and does
not call `onDrop`.

## Groups and scope

Groups are both target-interaction boundaries and lifecycle-routing
identifiers. One controller or provider can coordinate independent domains:

```ts
function onDragUpdate(event: DragUpdateEvent) {
  switch (event.group) {
    case "document-blocks":
      break;
    case "table-rows":
      break;
    case "table-columns":
      break;
  }
}
```

Do not encode domain information into `draggableId`. In React, one
`DragProvider` creates one scope and hooks read the nearest provider. Nested
providers are isolated scopes; cross-provider coordination is not a separate
feature.

## Live projection and commit

Use only normalized anchors. Application code must not recalculate target
midpoints, direction, hysteresis, or candidate selection.

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

Keep projected state local. Commit canonical state exactly once from
`onDrop`. Because `onDragEnd` precedes `onDrop`, clear projection immediately
for non-dropped results but retain a successful projection until the drop
callback commits.

The runnable carrier-backed table demonstrates this architecture with unequal
rows and columns, descendant menu-button handles, and ordinary sortable parity
references:

- Vanilla: `apps/web/src/vanilla/carrierTable.ts`, route `/carrier-table`
- React: `apps/react-web/src/react/carrierTable.tsx`, route `/carrier-table`
- Shared anchor application: `apps/shared/sortablePlacement.ts`
- Browser parity tests: `e2e/carrier-table.spec.ts`

## Layout changes during a drag

After application layout or scrolling changes target geometry, refresh cached
measurements and then publish through the normal update path:

```ts
controller.remeasureDropTargets({ group });
controller.recomputeActiveDrag();
```

Remeasurement alone does not publish. Recompute reuses the last raw pointer,
reapplies modifiers, and does not implicitly remeasure. Run the pair after the
projected DOM has committed, compare projected orders, and allow at most one
pending synchronization frame to avoid loops.

Vanilla owners should call `controller.cancelDrag()` before removing registered
DOM during teardown. The method is idle-safe and uses the normal cancellation
path for pending activation and active pointer or keyboard drags, including
sortable restoration, listener cleanup, and a canceled drag end without a
drop.

## Handles and overlays

Pointer activation delay and distance use OR semantics: reaching either
threshold activates. A quick release before activation remains a click. Once a
pointer drag activates, only the related generated click in the initiating
draggable subtree is suppressed; later intentional and keyboard clicks remain
available.

A button may be a pointer drag handle, but interactive filtering reserves Space
and Enter for button/menu activation. Provide another noninteractive or
separately focusable handle, or domain commands, for keyboard sorting.

When a pointer drag activates, the DOM runtime adds the stable
`data-dnd-pointer-drag-active="true"` marker to the initiating document root.
The DOM and React packages export `domPointerDragActiveAttribute`; consumers
choose the cursor with CSS:

```css
:root[data-dnd-pointer-drag-active="true"],
:root[data-dnd-pointer-drag-active="true"] *,
:root[data-dnd-pointer-drag-active="true"] *::before,
:root[data-dnd-pointer-drag-active="true"] *::after {
  cursor: grabbing !important;
}
```

Pending and keyboard drags do not set the marker. It is removed when the drag
ends, independently of a manual overlay release animation.

Sortables do not require overlays. Pointer targeting works without one;
rect-based targeting requires a measurable overlay. Overlay callbacks receive
`dragState.group`, so one scope can return group-specific blank row or column
elements. The source rectangle is measured from the carrier rather than its
thin button. Returning `null` is not equivalent to returning a measurable blank
element.

## Development

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm --filter @mk-drag-and-drop/dom test
pnpm --filter @mk-drag-and-drop/react test
pnpm playwright test
```

See the package READMEs and documentation under
`apps/react-web/src/mk-drag-and-drop` for the complete API and carrier guide.
