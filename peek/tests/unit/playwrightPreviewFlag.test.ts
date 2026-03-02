import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

test.each(["0", "false", ""])(
  "PLAYWRIGHT_PREVIEW=%j should keep dev server mode",
  async (value) => {
    process.env.PLAYWRIGHT_PREVIEW = value;
    const { default: config } = await import("../../playwright.config.ts");
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

    expect(webServer?.command).toContain("npm run dev");
    expect(config.use?.baseURL).toContain(":3000/");
  },
);

test("PLAYWRIGHT_PREVIEW unset should keep dev server mode", async () => {
  delete process.env.PLAYWRIGHT_PREVIEW;
  const { default: config } = await import("../../playwright.config.ts");
  const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

  expect(webServer?.command).toContain("npm run dev");
  expect(config.use?.baseURL).toContain(":3000/");
});
