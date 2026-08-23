import type { DragSource } from "./lifecycle.js";

export type SortableCoordinatorStartInput = {
  draggableId: string;
  group: string;
  source: DragSource;
  pointerPosition: { x: number; y: number };
  placementPosition: { x: number; y: number };
  movementPosition: { x: number; y: number };
};

export type SortableCoordinatorUpdateInput = SortableCoordinatorStartInput & {
  activeDropTargetId: string | null;
};

export type SortableCoordinator = {
  start: (input: SortableCoordinatorStartInput) => void;
  update: (input: SortableCoordinatorUpdateInput) => void;
  release: (input: { draggableId: string; group: string }) => void;
};

const coordinatorHosts = new WeakMap<object, object>();
const coordinators = new WeakMap<object, SortableCoordinator>();

export function linkSortableCoordinatorHost(
  publicRuntime: object,
  coordinatorHost: object,
): void {
  coordinatorHosts.set(publicRuntime, coordinatorHost);
}

export function setSortableCoordinator(
  runtime: object,
  coordinator: SortableCoordinator,
): void {
  coordinators.set(coordinatorHosts.get(runtime) ?? runtime, coordinator);
}

export function getSortableCoordinator(
  runtime: object,
): SortableCoordinator | null {
  return coordinators.get(coordinatorHosts.get(runtime) ?? runtime) ?? null;
}
