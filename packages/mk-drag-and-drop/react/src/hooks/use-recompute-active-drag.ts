import { useCallback, useContext } from "react";

import { DragContext } from "../drag-context.js";

export function useRecomputeActiveDrag(): () => void {
  const context = useContext(DragContext);

  if (!context) {
    throw new Error("useRecomputeActiveDrag must be used inside DragProvider");
  }

  const { runtime } = context;
  return useCallback(() => {
    runtime.recomputeActiveDrag();
  }, [runtime]);
}