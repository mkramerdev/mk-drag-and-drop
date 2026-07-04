import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("vanilla examples", () => {
  it("do not keep overlay-only item id bridge state", () => {
    for (const file of [
      "../../../../apps/web/src/vanilla/basicDrag.ts",
      "../../../../apps/web/src/vanilla/dropzoneList.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");

      expect(source).not.toContain("overlayItemId");
      expect(source).toContain("dragState.draggableId");
    }
  });
});
