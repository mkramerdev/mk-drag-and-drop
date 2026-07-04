import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("React examples", () => {
  it("do not keep overlay-only item id bridge state", () => {
    for (const file of [
      "../../../../apps/react-web/src/react/dropzoneList.tsx",
      "../../../../apps/react-web/src/react/sortableList.tsx",
      "../../../../apps/react-web/src/react/treeExample.tsx",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");

      expect(source).not.toContain("overlayItemId");
      expect(source).not.toContain("setOverlayItemId");
      expect(source).toContain("dragState.draggableId");
    }
  });

  it("renders complex overlays from drag state while keeping active UI state separate", () => {
    for (const file of [
      "../../../../apps/react-web/src/react/groupedExample.tsx",
      "../../../../apps/react-web/src/react/kanbanExample.tsx",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");

      expect(source).not.toContain("overlayDrag");
      expect(source).not.toContain("setOverlayDrag");
      expect(source).toContain("dragState.group");
      expect(source).toContain("dragState.draggableId");
    }
  });
});
