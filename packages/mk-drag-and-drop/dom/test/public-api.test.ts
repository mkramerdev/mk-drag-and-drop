import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as domApi from "../src/index.js";
import * as integrationApi from "../src/integration/index.js";

const removedPublicNames = [
  "cleanup",
  "dispose",
  "update",
  "finishOverlay",
  "createDragRuntimeHandle",
] as const;

describe("DOM public API", () => {
  it("does not expose runtime lifecycle or removed overlay controls from the root", () => {
    for (const name of removedPublicNames) {
      expect(domApi).not.toHaveProperty(name);
    }

    expect(domApi).toHaveProperty("createDragController");
    expect(domApi).toHaveProperty("createDraggable");
    expect(domApi).toHaveProperty("createDroppable");
    expect(domApi).toHaveProperty("createDropContainer");
    expect(domApi).toHaveProperty("createSortable");
  });

  it("createDragController exposes only public drag scope operations", () => {
    const controller = domApi.createDragController();

    expect(Object.keys(controller)).toEqual([
      "remeasureDropTargets",
      "remeasureOverlay",
    ]);
    expect(controller).toHaveProperty("remeasureDropTargets");
    expect(controller).toHaveProperty("remeasureOverlay");
    expect(controller).not.toHaveProperty("cleanup");
    expect(controller).not.toHaveProperty("dispose");
    expect(controller).not.toHaveProperty("update");
    expect(controller).not.toHaveProperty("configure");
    expect(controller).not.toHaveProperty("finishOverlay");
  });

  it("keeps integration exports scoped to adapter infrastructure", () => {
    for (const name of removedPublicNames) {
      expect(integrationApi).not.toHaveProperty(name);
    }

    expect(integrationApi).toHaveProperty("createDragRuntimeScope");
    expect(integrationApi).toHaveProperty("createDomDraggable");
    expect(integrationApi).toHaveProperty("createDomDroppable");
    expect(integrationApi).toHaveProperty("createDomDropContainer");
    expect(integrationApi).toHaveProperty("createDomSortable");
  });

  it("examples do not call removed controller lifecycle or overlay release APIs", () => {
    const exampleSources = [
      "../../../../apps/web/src/vanilla/basicDrag.ts",
      "../../../../apps/web/src/vanilla/sortableList.ts",
      "../../../../apps/web/src/vanilla/sortablePerformanceExample.ts",
    ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

    for (const source of exampleSources) {
      expect(source).not.toMatch(/\bkeepOverlayOnDrop\b/);
      expect(source).not.toMatch(/\bfinishOverlay\b/);
      expect(source).not.toMatch(/\bfinish\s*[:=]/);
    }
  });
});
