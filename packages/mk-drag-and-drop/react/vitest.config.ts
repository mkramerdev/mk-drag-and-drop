import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mk-drag-and-drop/dom": resolve(packageRoot, "../dom/src/index.ts"),
      "@mk-drag-and-drop/react": resolve(packageRoot, "src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
    restoreMocks: true,
  },
});
