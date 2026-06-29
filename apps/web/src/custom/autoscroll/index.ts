export type AutoscrollStartOptions = {
  onScrollOrRangeChange?: () => void;
};

export type AutoscrollController = {
  start: (options?: AutoscrollStartOptions) => void;
  stop: () => void;
};

export const autoscroll: AutoscrollController = {
  start: () => undefined,
  stop: () => undefined,
};
