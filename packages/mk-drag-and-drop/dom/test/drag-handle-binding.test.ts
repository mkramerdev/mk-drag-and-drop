import { describe, expect, it } from "vitest";

import {
  createDragHandle,
  domDragHandleAttribute,
} from "../src/index.js";

describe("createDragHandle", () => {
  it("adds the drag handle marker", () => {
    const element = document.createElement("button");

    createDragHandle({ element });

    expect(element.getAttribute(domDragHandleAttribute)).toBe("true");
  });

  it("returns void", () => {
    const element = document.createElement("button");
    const result = createDragHandle({ element });

    expect(result).toBeUndefined();
  });

  it("overwrites a previous marker value", () => {
    const element = document.createElement("button");
    element.setAttribute(domDragHandleAttribute, "custom");

    createDragHandle({ element });

    expect(element.getAttribute(domDragHandleAttribute)).toBe("true");
  });
});
