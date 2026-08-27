import { defineConfig, devices } from "@playwright/test";

const vanillaBaseUrl = "http://127.0.0.1:4173";
const reactBaseUrl = "http://127.0.0.1:4174";
const useProductionBuild = process.env.E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/carrier-table.spec.ts", "**/mobile-pointer.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `pnpm --filter web exec vite ${useProductionBuild ? "preview" : ""} --host 127.0.0.1 --port 4173 --strictPort`,
      url: vanillaBaseUrl,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter react-web exec vite ${useProductionBuild ? "preview" : ""} --host 127.0.0.1 --port 4174 --strictPort`,
      url: reactBaseUrl,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    createProject(
      "vanilla-chromium",
      vanillaBaseUrl,
      devices["Desktop Chrome"],
    ),
    createProject("react-chromium", reactBaseUrl, devices["Desktop Chrome"]),
    createProject(
      "vanilla-firefox",
      vanillaBaseUrl,
      devices["Desktop Firefox"],
    ),
    createProject("react-firefox", reactBaseUrl, devices["Desktop Firefox"]),
    createProject("vanilla-webkit", vanillaBaseUrl, devices["Desktop Safari"]),
    createProject("react-webkit", reactBaseUrl, devices["Desktop Safari"]),
    createMobilePointerProject(
      "vanilla-mobile-webkit",
      vanillaBaseUrl,
      devices["iPhone 16"],
    ),
    createMobilePointerProject(
      "react-mobile-webkit",
      reactBaseUrl,
      devices["iPhone 16"],
    ),
  ],
});

function createProject(
  name: string,
  baseURL: string,
  device: (typeof devices)[keyof typeof devices],
) {
  return {
    name,
    testIgnore: "**/mobile-pointer.spec.ts",
    use: { ...device, baseURL },
  };
}

function createMobilePointerProject(
  name: string,
  baseURL: string,
  device: (typeof devices)[keyof typeof devices],
) {
  return {
    name,
    testMatch: "**/mobile-pointer.spec.ts",
    use: { ...device, baseURL },
  };
}
