import { afterEach, describe, expect, it, vi } from "vitest";

import { acquireDocumentSelectionSuppression } from "../src/input/document-selection-state.js";

describe("document selection suppression", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    vi.restoreAllMocks();
  });

  it("suppresses standard and WebKit selection and guards selectstart", () => {
    const release = acquireDocumentSelectionSuppression(document);
    const selectStart = new Event("selectstart", {
      bubbles: true,
      cancelable: true,
    });

    expect(document.documentElement.style.userSelect).toBe("none");
    expect(document.documentElement.style.webkitUserSelect).toBe("none");
    expect(document.body.style.userSelect).toBe("none");
    expect(document.body.style.webkitUserSelect).toBe("none");
    expect(document.dispatchEvent(selectStart)).toBe(false);

    release();
    expect(
      document.dispatchEvent(new Event("selectstart", { cancelable: true })),
    ).toBe(true);
  });

  it("restores property values, priorities, and absence exactly", () => {
    document.documentElement.style.setProperty(
      "user-select",
      "text",
      "important",
    );
    document.documentElement.style.webkitUserSelect = "contain";
    document.body.style.setProperty("user-select", "all");
    const previousRootStyle = document.documentElement.getAttribute("style");
    const previousBodyStyle = document.body.getAttribute("style");
    const release = acquireDocumentSelectionSuppression(document);

    release();

    expect(document.documentElement.getAttribute("style")).toBe(
      previousRootStyle,
    );
    expect(document.body.getAttribute("style")).toBe(previousBodyStyle);
    expect(
      document.documentElement.style.getPropertyPriority("user-select"),
    ).toBe("important");
    expect(document.documentElement.style.webkitUserSelect).toBe("contain");
    expect(document.body.style.webkitUserSelect ?? "").toBe("");
  });

  it("keeps suppression until the final document owner releases", () => {
    document.documentElement.style.userSelect = "text";
    const releaseFirst = acquireDocumentSelectionSuppression(document);
    const releaseSecond = acquireDocumentSelectionSuppression(document);

    releaseFirst();
    releaseFirst();
    expect(document.documentElement.style.userSelect).toBe("none");

    releaseSecond();
    expect(document.documentElement.style.userSelect).toBe("text");
  });
});
