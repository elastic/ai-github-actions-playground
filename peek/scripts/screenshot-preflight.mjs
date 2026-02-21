import { chromium } from "playwright";
import fs from "node:fs/promises";

function parseFiniteNumber(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseArgs(argv) {
  const options = {
    url: process.env.SCREENSHOT_PRECHECK_URL ?? "http://127.0.0.1:3000",
    output: process.env.SCREENSHOT_PRECHECK_OUTPUT ?? "screenshot-preflight.json",
    screenshot: process.env.SCREENSHOT_PRECHECK_IMAGE,
    timeoutMs: parseFiniteNumber(process.env.SCREENSHOT_PRECHECK_TIMEOUT_MS, 30000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) options.url = argv[++i];
    else if (arg === "--output" && argv[i + 1]) options.output = argv[++i];
    else if (arg === "--screenshot" && argv[i + 1]) options.screenshot = argv[++i];
    else if (arg === "--timeout-ms" && argv[i + 1]) options.timeoutMs = parseFiniteNumber(argv[++i], 30000);
  }

  return options;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const diagnostics = {
    url: options.url,
    consoleErrors: [],
    pageErrors: [],
    uiErrors: [],
    capturedAt: new Date().toISOString(),
  };

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") diagnostics.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));

    try {
      try {
        await page.goto(options.url, { waitUntil: "networkidle", timeout: options.timeoutMs });

        diagnostics.uiErrors = await page.evaluate(() => {
          const seen = new Set();
          const errors = [];
          const errorSelectors = [
            ".MuiAlert-standardError",
            ".MuiAlert-filledError",
            "[data-testid='ErrorOutlineIcon']",
          ];

          for (const selector of errorSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = (
                element.closest("[role='alert']")?.textContent ?? element.parentElement?.textContent ?? ""
              ).trim();
              if (text && !seen.has(text)) {
                seen.add(text);
                errors.push(text);
              }
            }
          }
          return errors;
        });

        if (options.screenshot) {
          await page.screenshot({ path: options.screenshot, fullPage: true });
        }
      } catch (error) {
        diagnostics.pageErrors.push(String(error));
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    diagnostics.pageErrors.push(String(error));
  }

  await fs.writeFile(options.output, JSON.stringify(diagnostics, null, 2));

  const hasErrors =
    diagnostics.consoleErrors.length > 0 ||
    diagnostics.pageErrors.length > 0 ||
    diagnostics.uiErrors.length > 0;

  if (hasErrors) {
    console.error("Screenshot preflight failed. See diagnostics:", options.output);
    process.exit(1);
  }

  console.log("Screenshot preflight passed.");
}

run().catch((error) => {
  console.error("Screenshot preflight crashed:", error);
  process.exit(1);
});
