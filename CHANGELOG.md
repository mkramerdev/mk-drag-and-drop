# Changelog

All notable package changes will be documented here.

This project is still early, so release notes may stay brief until the public
API settles.

## 0.5.1

### Added

- Added the stable `data-dnd-pointer-drag-active="true"` document-root contract
  for active pointer drags and exported its
  `domPointerDragActiveAttribute` name from both packages.
- Added consumer cursor guidance for overriding explicit descendant cursors
  without injecting package presentation styles.

### Fixed

- Coordinated active pointer-drag markers across multiple runtime scopes in one
  document, with idempotent cleanup and exact restoration of pre-existing
  attribute state after the final lease releases.
- Bound pending and active pointer listeners, timers, animation frames,
  post-drag click suppression, and text-selection suppression to the initiating
  element's document and window so iframe-owned drags release correctly.
- Removed active pointer state before drag-end callbacks and manual overlay
  release rendering, including cancellation, invalid targets, failures, and
  provider/runtime cleanup.

## 0.5.0

### Breaking

- Added the activation-captured `group` to every drag lifecycle event and active
  reset event.
- Added the discriminated `SortablePreview` value to every
  `DragUpdateEvent`. Its `inactive`, `source`, and `projected` states replace
  target-id inference with normalized live placement.
- Sortable updates are now published only after the package-owned preview DOM
  has moved and the current placement has been normalized. Live preview and
  final drop use the same `SortableDropPlacement` normalization path.
- Removed the superseded sortable lifecycle subscription path and any alternate
  preview event shape.

### Added

- Added `DragController.cancelDrag()` so Vanilla owners can cancel pending or
  active input and restore package-owned preview DOM before teardown.
- Added live placement to `recomputeActiveDrag()`, including the documented
  `remeasureDropTargets({ group })` then recompute workflow.
- Added coordinated DOM and React exports and unchanged lifecycle forwarding for
  `SortablePreview` and captured drag groups.
- Added carrier-backed row and logical-column table examples for Vanilla DOM and
  React, with ordinary vertical and horizontal sortables as parity references.
- Added shared six-browser Playwright parity coverage for live projection,
  unequal dimensions, continuous midpoint/reversal trajectories, re-entry,
  cancellation, one-time commits without a drop-time jump, all overlay groups,
  two-axis autoscroll synchronization, and behavior-changing
  remeasure/recompute without another pointer movement.

### Changed

- An activated pointer drag suppresses only its related generated click, while
  a quick pre-activation release and later intentional clicks remain available.
- Interactive button handles remain pointer drag handles, but Space and Enter
  activate the button rather than starting keyboard dragging.

## 0.4.6

### Fixed

- Fixed active and pending pointer drags in the shared DOM runtime becoming
  stuck or using stale positions when descendant application handlers stop
  pointer-event propagation. Global pointer lifecycle events are now observed
  in capture phase for both direct DOM usage and React bindings.

## 0.4.5

### Fixed

- Fixed cross-container sortable preview state so midpoint entry applies to the
  first target in a newly entered list, including container-to-item transitions
  after active-drag recomputes, and subsequent targets in that list return to
  normal sortable placement.
- Fixed the first same-target move after midpoint-based cross-container entry so
  it holds position during same-position recomputes and establishes normal
  movement-responsive placement instead of being delayed by reversal hysteresis.
- Fixed cross-container sortable preview measurement refresh so source and
  destination list items shifted by a preview move do not keep stale target
  rects when a column grows or shrinks.
- Fixed `restrictToContainer` so active drags remeasure the resolved bounds
  element during movement instead of clamping against stale setup-time bounds
  when the container grows or shrinks.
- Fixed sortable preview direction tracking so placement shifts caused only by
  modifier remeasurement do not move a cross-container midpoint preview down
  when the raw pointer has not moved.

## 0.4.2

### Fixed

- Fixed Kanban-style cross-container sortable preview placement with rect-based
  targeting such as `centerToCenter` so the initial side uses the pointer
  position against the target midpoint while active target selection remains
  overlay-center based.
- Fixed cross-container detection after a container preview move by comparing
  against the drag-start source container instead of the live preview parent.

## 0.4.1

### Fixed

- Fixed cross-container sortable preview initial placement so items entering
  another container choose before/after from the target midpoint instead of the
  movement-responsive same-list placement behavior.
- Clarified sortable `placementBoundary` docs for cross-container entry vs
  reversal behavior.

## 0.4.0

### Added

- Added active-drag recompute behavior for rerunning targeting without pointer
  movement.
- Added DOM `controller.recomputeActiveDrag()`.
- Added React `useRecomputeActiveDrag()`.
- Clarified recompute vs remeasure behavior.

## 0.3.0

### Added

- Added `overlayRect: DragRect | null` to drag update and drag end lifecycle
  event data.
- Added DOM `controller.remeasureOverlay()` for manually refreshing cached
  overlay measurement.
- Added `remeasureOverlay` to the DOM `dragOverlay(...)` callback input.
- Added React `useRemeasureOverlay()`.
- Added `remeasureOverlay` to the React `dragOverlay` render input
  (`DragOverlayInput`).
