import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mk-drag-and-drop/dom/integration": resolve(
        packageRoot,
        "../dom/src/integration/index.ts",
      ),
      "@mk-drag-and-drop/dom": resolve(packageRoot, "../dom/src/index.ts"),
      "@mk-drag-and-drop/react": resolve(packageRoot, "src/index.ts"),
      "@repo/carrier-table-example/model": resolve(
        packageRoot,
        "../../../apps/shared/carrierTableModel.ts",
      ),
      "@repo/carrier-table-example/sortable-placement": resolve(
        packageRoot,
        "../../../apps/shared/sortablePlacement.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
    restoreMocks: true,
  },
});
