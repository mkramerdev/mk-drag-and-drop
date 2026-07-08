# Changelog

All notable package changes will be documented here.

This project is still early, so release notes may stay brief until the public
API settles.

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

