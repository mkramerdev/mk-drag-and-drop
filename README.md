# mk-drag-and-drop

`mk-drag-and-drop` is a headless, DOM-first drag-and-drop workspace. The DOM
package owns drag behavior, target measurement, targeting, lifecycle callbacks,
modifiers, overlays, and sortable/drop-container placement. The React package is
a thin adapter that wires React refs and effects into the same DOM runtime.

Apps own markup, styling, data, rendering, and final commits. The packages report
drag operations and placement data; they do not own application state or persist
changes for you.

Drag overlays use the same ownership split: apps create overlay content with
`dragOverlay`, while the packages own overlay hosting, movement, cleanup, and
measurement for targeting and modifiers.

## Packages

- `@mk-drag-and-drop/dom`: public DOM API for vanilla DOM apps, custom elements,
  and framework adapters.
- `@mk-drag-and-drop/react`: React provider and hooks over the DOM package.

Both packages are currently marked `private` in this workspace.

## Public Imports

Application code should use package root imports:

```ts
import {
  createDragController,
  createDraggable,
  createDroppable,
  createSortable,
} from "@mk-drag-and-drop/dom";
```

```tsx
import {
  DragProvider,
  useDraggable,
  useDroppable,
  useSortable,
} from "@mk-drag-and-drop/react";
```

The DOM package also exports `@mk-drag-and-drop/dom/integration` for adapter
authors who need lower-level DOM behaviors and a runtime handle. The React
package uses that subpath internally. The React package does not expose package
subpaths.

Deep imports into `src` or `dist` files are not part of the package exports.

## API Shape

The DOM root export includes:

- `createDragController`
- `createDraggable`
- `createDroppable`
- `createDropContainer`
- `createSortable`
- `createDragHandle`
- lifecycle event/helper types
- `DropPlacement`, `SortablePlacement`, `RemeasureDropTargetsInput`
- targeting helpers and types
- modifier helpers and types
- pointer and keyboard configuration types
- `DragPoint`, `DragRect`

The DOM integration subpath includes `createDragRuntimeHandle`, DOM behavior
factories such as `createDomDraggable`, `createDomDroppable`,
`createDomDropContainer`, and `createDomSortable`, related behavior/runtime
types, `DragState`, `DragOverlayPhase`, and `domDragHandleAttribute`.

The React root export includes `DragProvider`, `useDraggable`, `useDroppable`,
`useDropContainer`, `useSortable`, `useDragHandle`,
`useRemeasureDropTargets`, `composeRefs`, React-friendly
`restrictToContainer`, DOM targeting/modifier/type re-exports, and overlay
types.

## Naming And Placement

The current drag item identifier field is `draggableId`. Sortable and drop
placement fields use `previousDraggableId` and `nextDraggableId`.

`DropPlacement` contains:

- `draggableId`
- `dropTarget`
- `sourceContainerId`
- `containerId`
- `previousDraggableId`
- `nextDraggableId`

`SortablePlacement` contains:

- `draggableId`
- `previousDraggableId`
- `nextDraggableId`

Sortable behavior may move DOM nodes temporarily to preview placement during a
drag. The app still commits data on `onDrop` by reading lifecycle helpers such
as `getSortablePlacement` or `getDropPlacement`.

## Examples

Vanilla DOM examples live in `apps/web/src/vanilla`:

- `basicDrag.ts`
- `dropzoneList.ts`
- `sortableList.ts`
- `kanbanExample.ts`
- `groupedExample.ts`
- `treeExample.ts`

React examples live in `apps/react-web/src/react`:

- `basicDrag.tsx`
- `dropzoneList.tsx`
- `sortableList.tsx`
- `kanbanExample.tsx`
- `groupedExample.tsx`
- `treeExample.tsx`

The root `docs/` directory currently has no documentation files. Package-level
documentation lives in the DOM and React package READMEs.

## Development

Build commands used for package and example verification:

```bash
pnpm --filter @mk-drag-and-drop/dom build
pnpm --filter @mk-drag-and-drop/react... build
pnpm --filter web build
pnpm --filter react-web build
```

The root package also exposes:

```bash
pnpm build
pnpm lint
pnpm format
```

Package and app manifests also include `dev` and `preview` scripts where
applicable. Those start local Vite processes and are not required for static
build verification.
