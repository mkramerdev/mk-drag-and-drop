# Changelog

All notable package changes will be documented here.

This project is still early, so release notes may stay brief until the public
API settles.

## 0.4.3

### Fixed

- Fixed cross-container sortable preview state so midpoint entry applies to the
  first target in a newly entered list, including container-to-item transitions,
  and subsequent targets in that list return to normal sortable placement.
- Fixed same-target advancement after midpoint-based cross-container entry so
  continued movement can move the preview past the active target without waiting
  for the next target selection.

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

