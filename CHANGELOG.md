# Changelog

All notable package changes will be documented here.

This project is still early, so release notes may stay brief until the public
API settles.

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

