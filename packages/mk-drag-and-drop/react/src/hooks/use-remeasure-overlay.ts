import { useCallback, useContext } from "react";

import { DragContext } from "../drag-context.js";

export function useRemeasureOverlay(): () => void {
  const context = useContext(DragContext);

  if (!context) {
    throw new Error("useRemeasureOverlay must be used inside DragProvider");
  }

  const { remeasureOverlay } = context;
  return useCallback(() => {
    remeasureOverlay();
  }, [remeasureOverlay]);
}