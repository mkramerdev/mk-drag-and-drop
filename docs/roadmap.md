# Roadmap

This document tracks near-term package work that is planned or under
investigation. Completed changes should move to `CHANGELOG.md` when they ship.

## Overlay Movement Responsiveness

Status: investigated; cheap early overlay movement remains open.

Investigate splitting overlay movement into a cheap early path so the visual
drag overlay stays close to the pointer even when targeting or sortable work is
expensive.

Current code shape:

- Pointer movement is already batched into a single `requestAnimationFrame` path
  in the DOM runtime.
- DOM and React overlay movement are already imperative transform writes. React
  does not need to re-render overlay content for normal pointer movement.
- Manual overlay measurement APIs are now public, including lifecycle
  `overlayRect`, DOM and React `remeasureOverlay` helpers, and React
  `useRemeasureOverlay`. These APIs refresh cached overlay geometry; they do not
  split visual overlay movement from targeting work.
- Active-drag recomputation APIs are complete: DOM
  `controller.recomputeActiveDrag()` and React `useRecomputeActiveDrag()` rerun
  the normal active update and targeting path from the last pointer position.
  They do not refresh cached target measurements; call
  `remeasureDropTargets(...)` first when target geometry or registrations
  changed and those changes should affect targeting.
- The visual overlay move is still emitted only after modifier application,
  overlay rect calculation, sortable placement input calculation, target
  selection, and session replacement.
- That means targeting or other pre-move runtime work can delay the visual
  overlay even when the overlay adapter itself is cheap.

Planned direction:

1. On RAF, compute the movement position needed for visual placement.
2. Emit or apply the overlay transform immediately.
3. Then run targeting, sortable placement, subscriptions, lifecycle callbacks,
   announcements, and preview mutation.

Implementation notes:

- Keep drag modifiers in the visual path so constrained overlays still move to
  the same position users see today.
- Do not move lifecycle callbacks, announcements, or sortable preview mutation
  into the cheap visual path.
- The semantic drag session should still be updated after targeting, so
  lifecycle events keep receiving the correct `activeDropTargetId` and sortable
  placement data.
- Avoid duplicate overlay writes when the computed transform has not changed.
- Add regression coverage for ordering: overlay movement should be emitted
  before expensive targeting and before drag update callbacks for the same RAF.
- Add React coverage that pointer movement stays imperative and does not
  re-render overlay content on every move.

Public API impact:

- Manual overlay measurement APIs are complete: lifecycle `overlayRect`, DOM
  `controller.remeasureOverlay()`, DOM overlay input `remeasureOverlay`, React
  `useRemeasureOverlay()`, and React overlay input `remeasureOverlay`.
- Active-drag recomputation APIs are complete: DOM
  `controller.recomputeActiveDrag()` and React `useRecomputeActiveDrag()`.
- No additional application-level public API change appears necessary for the
  remaining cheap visual movement split.
- `dragOverlay`, `DragOverlayInput`, `overlayRelease`, modifiers, targeting
  algorithms, and sortable options should keep their current shape.
- `DragOverlayHostUpdate` is exported from the DOM integration entrypoint and is
  used by the React adapter. If the implementation wants a narrower move
  payload for the cheap visual path, keep it internal or preserve the exported
  integration type to avoid an unnecessary public API break.
- Do not add overlay performance knobs until profiling proves the internal split
  is not enough.
