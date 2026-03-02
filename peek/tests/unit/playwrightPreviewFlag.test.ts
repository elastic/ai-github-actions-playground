import { expect, test } from "vitest";

test('PLAYWRIGHT_PREVIEW="0" should keep dev server mode', async () => {
  process.env.PLAYWRIGHT_PREVIEW = "0";
  const { default: config } = await import("../../playwright.config.ts");
  const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

  expect(webServer?.command).toContain("npm run dev");
  expect(config.use?.baseURL).toContain(":3000/");
});
