import { defineConfig, devices } from "@playwright/test";

// NOTE: worktree を並べて e2e を同時に走らせるため、ポートを環境変数で変えられるようにする。
const port = process.env.E2E_PORT ?? "3939";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bun run build && wrangler dev --port ${port} --var DEV_OWNER_ID:e2e-default`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
