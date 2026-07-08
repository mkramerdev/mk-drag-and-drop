import { createContext } from "react";

import type { DragRuntimeScope } from "@mk-drag-and-drop/dom/integration";

export type DragContextValue = {
  runtime: DragRuntimeScope;
  keyboardDragEnabled: boolean;
  remeasureOverlay: () => void;
};

export const DragContext = createContext<DragContextValue | null>(null);
