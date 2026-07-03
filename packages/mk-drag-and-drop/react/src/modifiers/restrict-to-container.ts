import type { RefObject } from "react";

import {
  restrictToContainer as restrictDomToContainer,
  type DragModifier,
  type DragRect,
  type RestrictToContainerResolver,
} from "@mk-drag-and-drop/dom";

export type ReactRestrictToContainerInput =
  | RefObject<HTMLElement | null>
  | RestrictToContainerResolver;

export function restrictToContainer(
  input: ReactRestrictToContainerInput,
): DragModifier<DragRect | null> {
  if (isRefObject(input)) {
    return restrictDomToContainer(() => input.current);
  }

  return restrictDomToContainer(input);
}

function isRefObject(
  input: ReactRestrictToContainerInput,
): input is RefObject<HTMLElement | null> {
  return typeof input === "object" && input !== null && "current" in input;
}
