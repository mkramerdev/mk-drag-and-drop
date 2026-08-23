import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@mk-drag-and-drop/react",
        replacement: fileURLToPath(
          new URL(
            "../../packages/mk-drag-and-drop/react/src/index.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: "@mk-drag-and-drop/dom/integration",
        replacement: fileURLToPath(
          new URL(
            "../../packages/mk-drag-and-drop/dom/src/integration/index.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: "@mk-drag-and-drop/dom",
        replacement: fileURLToPath(
          new URL(
            "../../packages/mk-drag-and-drop/dom/src/index.ts",
            import.meta.url,
          ),
        ),
      },
    ],
  },
});
