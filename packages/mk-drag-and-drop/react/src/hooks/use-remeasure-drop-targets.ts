import { useCallback, useContext } from "react";

import type { RemeasureDropTargetsInput } from "@mk-drag-and-drop/dom";

import { DragContext } from "../drag-context.js";

export function useRemeasureDropTargets(): (
  input?: RemeasureDropTargetsInput,
) => void {
  const runtime = useContext(DragContext);

  if (!runtime) {
    throw new Error("useRemeasureDropTargets must be used inside DragProvider");
  }

  return useCallback(
    (input?: RemeasureDropTargetsInput) => {
      runtime.remeasureDropTargets(input);
    },
    [runtime],
  );
}
