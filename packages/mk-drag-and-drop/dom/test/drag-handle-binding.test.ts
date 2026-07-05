import { describe, expect, it } from "vitest";

import { createDragHandle } from "../src/index.js";
import { domDragHandleAttribute } from "../src/input/drag-handle.js";

describe("createDragHandle", () => {
  it("adds the drag handle marker", () => {
    const element = document.createElement("button");

    createDragHandle({ element });

    expect(element.getAttribute(domDragHandleAttribute)).toBe("true");
  });

  it("overwrites a previous marker value", () => {
    const element = document.createElement("button");
    element.setAttribute(domDragHandleAttribute, "custom");

    createDragHandle({ element });

    expect(element.getAttribute(domDragHandleAttribute)).toBe("true");
  });
});
