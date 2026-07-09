# Changelog

All notable package changes will be documented here.

This project is still early, so release notes may stay brief until the public
API settles.

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

