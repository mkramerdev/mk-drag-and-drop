import { createContext } from "react";

import type { DragRuntimeHandle } from "@mk-drag-and-drop/dom/integration";

export type DragContextValue = {
  runtime: DragRuntimeHandle;
  keyboardDragEnabled: boolean;
};

export const DragContext = createContext<DragContextValue | null>(null);
