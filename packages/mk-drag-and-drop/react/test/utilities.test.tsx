import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";

import {
  composeRefs,
  restrictToContainer,
  type DragModifierTransformInput,
} from "../src/index.js";
import { createRect, stubBoundingClientRect } from "./test-utils.js";

describe("React utilities", () => {
  it("composeRefs writes callback and object refs", () => {
    const callbackRef = vi.fn();
    const objectRef = createRef<HTMLDivElement>();
    const element = document.createElement("div");
    const ref = composeRefs<HTMLDivElement>(callbackRef, objectRef);

    ref(element);

    expect(callbackRef).toHaveBeenCalledWith(element);
    expect(objectRef.current).toBe(element);
  });

  it("restrictToContainer uses the provided React ref", () => {
    const container = document.createElement("div");
    stubBoundingClientRect(
      container,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    const containerRef = { current: container };
    const modifier = restrictToContainer(containerRef);
    const state = modifier.setup?.({
      itemId: "item-1",
      group: "items",
      sourceRect: createRect({ width: 20, height: 20 }),
      initialPointerPosition: { x: 10, y: 10 },
    });
    const transformInput: DragModifierTransformInput<typeof state> = {
      itemId: "item-1",
      group: "items",
      sourceRect: createRect({ width: 20, height: 20 }),
      initialPointerPosition: { x: 10, y: 10 },
      rawPointerPosition: { x: 120, y: 120 },
      pointerPosition: { x: 120, y: 120 },
      overlayRect: createRect({ left: 110, top: 110, width: 20, height: 20 }),
      state,
    };

    expect(modifier.transform(transformInput)).toEqual({ x: 90, y: 90 });
  });
});
