import type { RefObject } from "react";

import {
  restrictToContainer as restrictDomToContainer,
  type DragModifier,
  type DragRect,
} from "@mk-drag-and-drop/dom";

export function restrictToContainer(
  containerRef: RefObject<HTMLElement | null>,
): DragModifier<DragRect | null> {
  return restrictDomToContainer(() => containerRef.current);
}
