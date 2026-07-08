import { describe, expect, it } from "vitest";

import * as reactApi from "../src/index.js";

const removedPublicNames = [
  "cleanup",
  "dispose",
  "update",
  "finishOverlay",
  "createDragRuntimeHandle",
] as const;

describe("React public API", () => {
  it("does not expose runtime lifecycle or removed overlay controls", () => {
    for (const name of removedPublicNames) {
      expect(reactApi).not.toHaveProperty(name);
    }

    expect(reactApi).toHaveProperty("DragProvider");
    expect(reactApi).toHaveProperty("useDraggable");
    expect(reactApi).toHaveProperty("useDroppable");
    expect(reactApi).toHaveProperty("useDropContainer");
    expect(reactApi).toHaveProperty("useSortable");
    expect(reactApi).toHaveProperty("useRemeasureDropTargets");
    expect(reactApi).toHaveProperty("useRemeasureOverlay");
  });
});
