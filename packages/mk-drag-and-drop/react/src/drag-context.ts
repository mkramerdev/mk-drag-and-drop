import { createContext } from "react";

import type { DragRuntime } from "@mk-drag-and-drop/dom";

export const DragContext = createContext<DragRuntime | null>(null);
