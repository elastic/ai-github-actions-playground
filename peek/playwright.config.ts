import { defineConfig, devices } from "@playwright/test";

const preview = !["", "0", "false"].includes(process.env.PLAYWRIGHT_PREVIEW ?? "");
const port = preview ? 4173 : 3000;
const baseURL = `http://localhost:${port}/ai-github-actions-playground/`;

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? "50%" : undefined,
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "on",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: preview ? `npm run preview -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 120_000 : undefined,
  },
});
