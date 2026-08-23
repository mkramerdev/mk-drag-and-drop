# @mk-drag-and-drop/react

React provider and hooks for `@mk-drag-and-drop/dom`. React forwards the DOM
runtime's public lifecycle events unchanged and re-exports the same event,
placement, targeting, modifier, input, geometry, and overlay types.

```tsx
import {
  DragProvider,
  useDragHandle,
  useRecomputeActiveDrag,
  useRemeasureDropTargets,
  useSortable,
  type DragUpdateEvent,
  type SortablePreview,
} from "@mk-drag-and-drop/react";
```

There is no separate React preview channel or React placement type.

## Provider scope

One `DragProvider` creates one drag-and-drop scope. Hooks use the nearest
provider, and nested providers are isolated scopes. Nested-provider
coordination is not a special public feature.

Groups within one provider are both target boundaries and lifecycle-routing
identifiers:

```tsx
<DragProvider
  onDragUpdate={(event) => {
    switch (event.group) {
      case "document-blocks":
        break;
      case "table-rows":
        break;
      case "table-columns":
        break;
    }
  }}
>
  <EditorAndTable />
</DragProvider>
```

Do not encode the interaction domain into `draggableId` and do not create
separate providers merely to distinguish rows from columns.

## Final lifecycle contract

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
  result: DragEndResult;
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

The group is captured at successful activation and is unchanged for the whole
session, including announcements and adapter reset. Registration changes can
invalidate the source or target, but cannot alter the event group.

Every normal update includes `sortablePreview`:

| Status      | Meaning                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `inactive`  | The drag is plain or its source is no longer a valid sortable registration in the captured group.                       |
| `source`    | The normalized preview equals the captured source position, including initial/no-target/no-op/returned placement.       |
| `projected` | The normalized preview differs from source, including cross-container, container-only, and retained no-target movement. |

`source` placement has canonical source anchors and null target/side.
Container-only projected placement also has null target/side while container
and sibling anchors identify the projected location.

The provider callback observes the package after sortable preview mutation and
normalization. `DropEvent.sortablePlacement` is produced by that same
normalizer; a successful source/no-op drop omits it. Package carrier DOM has
already been restored when public `onDragEnd` and `onDrop` run. Cancellation
does not synthesize a last update; invalid release produces `invalid-target` and
does not invoke `onDrop`.

## Sortable projection

```tsx
function Row({ id }: { id: string }) {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: id,
    group: "table-rows",
    axis: "vertical",
  });

  return <div {...sortable}>{id}</div>;
}
```

Project application presentation from normalized anchors only:

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

```tsx
<DragProvider
  onDragUpdate={(event) => {
    if (event.group === tableColumnGroup) {
      setProjectedColumns(getProjectedOrder(canonicalColumns, event));
    }
  }}
  onDragEnd={(event) => {
    if (event.result !== "dropped") clearProjection(event.group);
  }}
  onDrop={(event) => {
    if (event.group === tableColumnGroup && event.sortablePlacement) {
      commitColumnsOnce(event.sortablePlacement);
    }
    clearProjection(event.group);
  }}
>
  <Table />
</DragProvider>
```

`onDragEnd` precedes `onDrop`, so retain successful projected state until the
drop callback commits. Do not mutate canonical React state from
`onDragUpdate`, and do not inspect carrier DOM. `applySortablePlacement` removes
the dragged id and uses target/side or previous/next anchors; it does not run
target selection, midpoint, direction, or hysteresis logic.

## Geometry synchronization hooks

```tsx
function GeometrySync({ group }: { group: string }) {
  const remeasureDropTargets = useRemeasureDropTargets();
  const recomputeActiveDrag = useRecomputeActiveDrag();

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      remeasureDropTargets({ group });
      recomputeActiveDrag();
    });
    return () => cancelAnimationFrame(frame);
  }, [group, remeasureDropTargets, recomputeActiveDrag]);

  return null;
}
```

Remeasurement only refreshes cached geometry. Recompute reuses the last raw
pointer, reapplies modifiers, and publishes via the same completed preview path;
it does not implicitly remeasure. Schedule after projected DOM commit, skip
unchanged orders, allow at most one pending frame, and cancel it on end/unmount.

## Descendant menu-button handles

```tsx
function Carrier({ id }: { id: string }) {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: id,
    group: "table-columns",
    axis: "horizontal",
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...sortable}>
      <button {...handle} type="button" aria-label={`Column ${id} menu`}>
        Menu
      </button>
    </div>
  );
}
```

Pointer activation delay and distance use OR semantics. A quick release before
activation remains a click. An activated drag suppresses only the related
generated click, while a later intentional click works. Space and Enter remain
button/menu activation keys and do not start keyboard dragging because the
handle is interactive. Use another appropriate handle or explicit commands for
keyboard sorting; editable descendants remain protected.

## Overlays

Sortable behavior does not require an overlay. Pointer targeting works without
one; rect-based targeting needs one. Route blank measurable elements using the
captured group:

```tsx
<DragProvider
  dragOverlay={({ dragState }) => (
    <div
      className={
        dragState.group === "table-rows" ? "rowOverlay" : "columnOverlay"
      }
      aria-hidden="true"
    />
  )}
>
  <Table />
</DragProvider>
```

The package wrapper is pointer-inert. A carrier's source rect, rather than a
thin button's rect, provides initial dimensions; before content measurement the
runtime uses the translated source rect. A returned real blank element can be
measured and may exceed button dimensions. Returning `null` from a configured
callback is not equivalent.

## Public hooks

- `useDraggable`
- `useDroppable`
- `useDropContainer`
- `useSortable`
- `useDragHandle`
- `useRemeasureDropTargets`
- `useRecomputeActiveDrag`
- `useRemeasureOverlay`

`DragProvider` also accepts lifecycle callbacks, announcement callbacks,
pointer/keyboard configuration, targeting, modifiers, `dragOverlay`, and overlay
release configuration. Announcement callbacks receive the same group-bearing
lifecycle events as ordinary callbacks.

The carrier table is runnable at `/carrier-table` in both repository
playgrounds. Its React source is `apps/react-web/src/react/carrierTable.tsx`; the
Vanilla source is `apps/web/src/vanilla/carrierTable.ts`.
