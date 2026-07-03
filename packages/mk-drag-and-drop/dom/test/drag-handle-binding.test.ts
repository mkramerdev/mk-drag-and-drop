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

  it("removes a marker added by the helper on cleanup", () => {
    const element = document.createElement("button");
    const cleanup = createDragHandle({ element });

    cleanup();

    expect(element.hasAttribute(domDragHandleAttribute)).toBe(false);
  });

  it("restores the previous marker value on cleanup", () => {
    const element = document.createElement("button");
    element.setAttribute(domDragHandleAttribute, "custom");

    const cleanup = createDragHandle({ element });

    expect(element.getAttribute(domDragHandleAttribute)).toBe("true");

    cleanup();

    expect(element.getAttribute(domDragHandleAttribute)).toBe("custom");
  });

  it("is idempotent", () => {
    const element = document.createElement("button");
    const cleanup = createDragHandle({ element });

    cleanup();
    cleanup();

    expect(element.hasAttribute(domDragHandleAttribute)).toBe(false);
  });
});
