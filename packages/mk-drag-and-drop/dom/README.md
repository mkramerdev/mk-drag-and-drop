# mk-drag-and-drop

## What It Is

`mk-drag-and-drop` is a DOM-first drag-and-drop runtime. The DOM package provides the behavior layer: input handling, drag lifecycle state, target registration, measurement, targeting, overlays, modifiers, sortable previews, and drop container placement.

The framework packages are thin adapters over that same runtime. React hooks register DOM nodes through refs and `DragProvider` owns a runtime instance, but React is not a separate drag system.

The library is designed for user-owned rendering and data. It reports drag operations through lifecycle callbacks; your app decides how to update state, persist data, style elements, and commit the final UI.

The runtime supports pointer dragging and keyboard dragging where configured. It also supports drag overlays, targeting algorithms and constraints, movement modifiers, sortable DOM previews, and drop containers for placement-style interactions.

Use the DOM package directly when you are building with vanilla DOM, another framework, custom elements, or an integration where you want to wire the runtime to your own rendering layer. Use the React package when React refs and effects are the most convenient way to register the same DOM runtime.

## Why It Exists

Many drag-and-drop libraries couple behavior tightly to React rendering, a particular state model, or one list abstraction. That works for some cases, but it makes custom targets, nested structures, mixed draggable types, and non-React surfaces harder than they need to be.

This package separates runtime behavior from rendering. The DOM runtime owns the mechanics of a drag. The app owns the data model and the final UI. That same split lets applications build simple lists, kanban boards, trees, grouped drag/drop, and custom target systems with the same primitives.

On drop, the package reports what happened. Your app reads the event and helper methods, updates its own data, and rerenders or mutates the DOM however it wants.

## Core Idea

The mental model is:

1. Create a controller or runtime.
2. Register draggable sources.
3. Register droppable targets.
4. Optionally register sortable items or drop containers.
5. The runtime measures targets.
6. Pointer or keyboard input updates the active target.
7. Lifecycle callbacks report drag start, updates, end, and drop.
8. The app commits its own data and rendering changes.

The key invariant is: the package reports operations; the app owns the result.

## Architecture

### Controller

`createDragController` is the usual DOM entry point. It creates a stable object around a `DragRuntime`, accepts runtime configuration, forwards lifecycle callbacks, and exposes `remeasureDropTargets`.

The controller also manages DOM overlay rendering when `dragOverlay` is configured. If `announcements` are provided, it creates a polite live region and writes the returned announcement messages during lifecycle events.

### Runtime

`DragRuntime` owns drag session state. It starts pointer or keyboard drags, tracks the active input, applies modifiers, resolves active drop targets, notifies lifecycle callbacks and subscriptions, and cleans up global listeners.

The runtime exposes registration methods for drop targets and containers, placement helpers such as `getDropPlacement` and `getSortablePlacement`, explicit measurement through `remeasureDropTargets`, subscriptions, `cleanup`, and `dispose`.

### Draggable

`createDraggable` registers pointer and keyboard start behavior on an element. It associates that element with an `itemId` and optional group.

If a drag handle exists inside the draggable element, dragging starts from the handle. Editable child elements are ignored so text inputs and editable content can keep their normal behavior.

### Droppable

`createDroppable` registers an element as a drop target. A droppable has a `targetId`, optional group, and optional `containerId`.

Groups keep unrelated drag systems from targeting each other. Container metadata lets placement helpers describe where an item should move in a larger structure.

### Drop Containers

`createDropContainer` registers a container boundary as a drop target with container capabilities. It is useful for placement APIs where an item can move into an empty or populated container, such as kanban columns or lists.

When a drop lands on a container, `getDropPlacement` can report the container id plus neighboring sortable item ids so the app can decide where to insert the item.

### Sortable

`createSortable` combines draggable behavior with drop target registration for the same element. Sortable items can participate in reordering and can be used with drop containers for movement between containers.

Sortable owns a transient DOM preview during the drag. It may move the dragged element in the DOM to show where the item would land, but it does not commit application data. On drop, the app reads `getSortablePlacement` or `getDropPlacement` and updates its own order.

### Targeting

Targeting algorithms choose one target from the currently measured candidates. Built-in algorithms include `pointerToCenter`, `centerToCenter`, and `pointerToRectDistance`.

Targeting constraints filter candidates before the algorithm chooses. `maxDistanceToRect` is one built-in constraint. Apps can also provide custom algorithms and constraints, such as vertical tree-row targeting or grouped drag rules.

### Modifiers

Modifiers transform pointer movement before the runtime updates drag state. Built-ins include `lockToXAxis`, `lockToYAxis`, and `restrictToContainer`.

Modifiers affect drag movement and overlay position. They do not update application data or change what the app commits on drop.

### Measurement

Drop targets are measured in document coordinates and converted back to viewport coordinates during targeting so scrolling is accounted for. The runtime remeasures at drag start, and apps can call `remeasureDropTargets` when layout changes during a drag.

Sortable previews may schedule remeasurement after preview movement. For custom layout changes, use the controller or React hook to remeasure all targets, specific target ids, or a group.

## DOM Usage Example

This example uses the DOM package for behavior and ordinary app code for rendering and data updates.

```ts
import {
  createDragController,
  createDraggable,
  createDroppable,
} from "@mk-drag-and-drop/dom";

const state = {
  itemLocation: "todo",
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root");
}

const status = document.createElement("p");
const item = document.createElement("button");
const columns = ["todo", "done"];

const controller = createDragController({
  onDrop({ itemId, dropTarget }) {
    // App-owned data update. The package reports the operation only.
    state.itemLocation = dropTarget;
    status.textContent = `${itemId} moved to ${dropTarget}`;
  },
});

item.type = "button";
item.textContent = "Drag me";
item.setAttribute("aria-label", "Drag item");

createDraggable({
  controller,
  element: item,
  itemId: "task-1",
});

root.append(status, item);

for (const columnId of columns) {
  const column = document.createElement("section");
  const label = document.createElement("h2");

  label.textContent = columnId;
  column.append(label);

  createDroppable({
    controller,
    element: column,
    targetId: columnId,
  });

  root.append(column);
}

status.textContent = `task-1 starts in ${state.itemLocation}`;

window.addEventListener("pagehide", () => controller.dispose(), {
  once: true,
});
```

## React Usage

The React package wraps the DOM runtime. `DragProvider` creates and configures the runtime, then hooks such as `useDraggable`, `useDroppable`, `useDropContainer`, and `useSortable` register DOM nodes through refs.

The app still owns state and rendering. The same lifecycle concepts apply: `onDrop` receives the operation, helper methods expose placement, and the app commits the data change.

```tsx
import {
  DragProvider,
  useDragHandle,
  useSortable,
} from "@mk-drag-and-drop/react";

function List({ items, moveItem }) {
  return (
    <DragProvider
      onDrop={({ itemId }, { getSortablePlacement }) => {
        const placement = getSortablePlacement(itemId);

        if (placement) {
          moveItem(placement);
        }
      }}
    >
      {items.map((item) => (
        <Row key={item.id} id={item.id} label={item.label} />
      ))}
    </DragProvider>
  );
}

function Row({ id, label }) {
  const sortable = useSortable({ itemId: id });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...sortable}>
      <button {...handle} aria-label={`Drag ${label}`} type="button">
        Drag
      </button>
      {label}
    </div>
  );
}
```

## Data Ownership

The library never owns application data. Item ids, target ids, group ids, and container ids are identifiers that your app maps to its own model.

`onDrop` is where users commit changes. For sortable lists, the preview is transient. After the drop, update your own state or data store, persist if needed, and rerender or patch the DOM using your app's normal rendering path.

Some examples fully rerender after a drop because that is simple demo code. Full rerendering is not a package invariant.

## Cleanup Model

Controllers and runtimes expose `cleanup` and `dispose`. `cleanup` ends active drag resources such as global listeners and overlays. `dispose` performs final teardown, including runtime callbacks, registered targets, subscriptions, overlays, and live regions created by the controller.

React users usually rely on `DragProvider` and the hooks. The provider disposes the runtime on unmount, and hooks clean up through refs and effects internally.

Vanilla users should dispose the controller when tearing down the view or app that owns it. Prefer public registrations and adapters over manual runtime mutation for individual elements. Disconnected targets are pruned on drag-critical paths, and the runtime registry is cleared on dispose.

## Accessibility

Keyboard dragging exists where keyboard configuration is enabled. The default keyboard commands use Space or Enter to start and drop, Escape to cancel, and arrow keys to move by a configured distance.

Drag handles and focusable draggable elements should have clear labels. If an element is only a visual handle, give it an `aria-label` that matches the task.

Announcements are available only when configured. The DOM controller and React provider can create polite live regions when `announcements` callbacks are provided. The package does not claim complete screen-reader drag-and-drop support; apps should provide task-specific instructions and announcements for their interaction model.

## Current Status / Design Notes

The DOM package is the source of drag behavior. The React package is an adapter over the same runtime, not a separate drag-and-drop implementation.

The examples show common patterns: basic dragging, dropzone lists, sortable lists, kanban movement, grouped drag/drop, and tree-like targeting. Advanced behavior such as auto-scroll, richer announcements, and complex virtualization may require additional app integration or future package work.

## Development

This repo uses pnpm workspaces and Turborepo. The package scripts currently expose these useful build commands:

```bash
pnpm --filter @mk-drag-and-drop/dom build
pnpm --filter @mk-drag-and-drop/react... build
pnpm --filter web build
pnpm --filter react-web build
```

Other real scripts include root `build`, `lint`, and `format`, plus package-level `lint`, `test`, and `test:watch` scripts for the DOM and React packages.
