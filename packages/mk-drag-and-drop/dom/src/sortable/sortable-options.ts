export type SortableAxis = "vertical" | "horizontal";

export type SortablePlacementBoundary = {
  start?: number;
  end?: number;
};

export type SortableOptions = {
  axis?: SortableAxis;
  placementBoundary?: SortablePlacementBoundary;
};

export type NormalizedSortableOptions = {
  axis: SortableAxis;
  placementBoundary: {
    start: number;
    end: number;
  };
};

const defaultSortableAxis: SortableAxis = "vertical";
const defaultPlacementBoundary = {
  start: 0.25,
  end: 0.75,
};

export function normalizeSortableOptions(
  options: SortableOptions | undefined,
): NormalizedSortableOptions {
  return {
    axis: options?.axis === "horizontal" ? "horizontal" : defaultSortableAxis,
    placementBoundary: {
      start: normalizeBoundaryRatio(
        options?.placementBoundary?.start,
        defaultPlacementBoundary.start,
      ),
      end: normalizeBoundaryRatio(
        options?.placementBoundary?.end,
        defaultPlacementBoundary.end,
      ),
    },
  };
}

function normalizeBoundaryRatio(
  value: number | undefined,
  defaultValue: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return defaultValue;
  }

  return Math.min(1, Math.max(0, value));
}
