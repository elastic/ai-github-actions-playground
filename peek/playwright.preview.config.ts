/**
 * Playwright config for running E2E tests against the production build
 * (vite preview) instead of the dev server. Use this to catch issues —
 * like circular chunk dependencies — that only appear in the bundled output.
 *
 * Usage: make test-e2e-preview
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? "50%" : undefined,
  use: {
    baseURL: "http://localhost:4173/ai-github-actions-playground/",
    trace: process.env.CI ? "on-first-retry" : "on",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173/ai-github-actions-playground/",
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 120_000 : undefined,
  },
});
