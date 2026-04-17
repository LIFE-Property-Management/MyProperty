import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// localhost (not 127.0.0.1) matches the host that `next dev` binds to; using
// the IPv4 literal triggers Turbopack's cross-origin dev-resource guard.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Spawn `next dev` at the configured port. MSW registers in dev mode, so the
  // tenant portal's data handlers resolve against the fixtures under /mocks.
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "development",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
});
