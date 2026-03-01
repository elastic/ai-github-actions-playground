import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? "50%" : undefined,
  use: {
    baseURL: "http://localhost:3000/ai-github-actions-playground/",
    trace: process.env.CI ? "on-first-retry" : "on",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3000",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 120_000 : undefined,
  },
});
