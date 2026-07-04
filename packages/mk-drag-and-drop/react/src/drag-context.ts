import { createContext } from "react";

import type { DragRuntimeHandle } from "@mk-drag-and-drop/dom/integration";

export const DragContext = createContext<DragRuntimeHandle | null>(null);
