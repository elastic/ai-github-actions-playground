/**
 * screenshot-add-data-helpers.mjs
 *
 * Shared Playwright helpers for capturing Add Data wizard screenshots.
 * Used by both screenshot-all.mjs and screenshot-add-data.mjs.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  ADD_DATA_EXPERIENCE_LABELS,
  ADD_DATA_PRIMARY_EXPERIENCES,
  ADD_DATA_TECHNOLOGY_ENTRIES,
} from "../src/services/addData/catalog.data.mjs";

/**
 * Wait for the page to settle after a navigation click.
 * Uses networkidle (no requests for 500ms) instead of a fixed timeout —
 * this resolves almost instantly with mocked routes and adapts to real latency
 * in live mode.
 */
export async function waitForSettle(page, timeoutMs = 30_000) {
  await page.waitForLoadState("networkidle", { timeout: timeoutMs });
}

/** Navigate to Add Data Step 1 by clicking away then back. */
async function resetToAddDataLanding(page, timeoutMs) {
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await waitForSettle(page, timeoutMs);
  await page.getByRole("button", { name: "Add Data", exact: true }).click();
  await waitForSettle(page, timeoutMs);
}

/** Open the technology list for an experience. */
async function openExperience(page, experience, timeoutMs) {
  if (experience === "advanced") {
    await page.locator("button").filter({ hasText: "Advanced" }).first().click();
  } else {
    await page
      .getByText(ADD_DATA_EXPERIENCE_LABELS[experience], { exact: true })
      .first()
      .click();
  }
  await waitForSettle(page, timeoutMs);
}

/** Select a technology card by its display name. */
async function selectTechnology(page, technologyName, timeoutMs) {
  await page.locator("[aria-pressed]").filter({ hasText: technologyName }).first().click();
  await waitForSettle(page, timeoutMs);
}

/**
 * Capture all Add Data screenshots: landing, experience lists, Step 2 for
 * every technology, and Step 3 for the first technology per guide type.
 *
 * @param {import("playwright").Page} page - Playwright page (already connected)
 * @param {string} outDir - Directory to write screenshots into
 * @param {number} timeoutMs - Per-page timeout in ms for settle waits
 * @returns {Promise<number>} Number of screenshots captured
 */
export async function captureAddDataScreenshots(page, outDir, timeoutMs = 30_000) {
  await fs.mkdir(outDir, { recursive: true });
  let captured = 0;

  // Navigate to Add Data
  await page.getByRole("button", { name: "Add Data", exact: true }).click();
  await waitForSettle(page, timeoutMs);

  // 1. Landing page
  await page.screenshot({ path: path.join(outDir, "add-data-landing.png"), fullPage: true });
  console.log("  add-data-landing");
  captured += 1;

  // 2. Each experience's technology list
  for (const exp of [...ADD_DATA_PRIMARY_EXPERIENCES, "advanced"]) {
    await resetToAddDataLanding(page, timeoutMs);
    await openExperience(page, exp, timeoutMs);

    const slug = exp.replace(/_/g, "-");
    await page.screenshot({
      path: path.join(outDir, `add-data-experience-${slug}.png`),
      fullPage: true,
    });
    console.log(`  add-data-experience-${slug}`);
    captured += 1;
  }

  // 3. Step 2 for every technology + Step 3 for first per guide type
  const capturedStep3GuideTypes = new Set();

  for (const tech of ADD_DATA_TECHNOLOGY_ENTRIES) {
    await resetToAddDataLanding(page, timeoutMs);
    await openExperience(page, tech.experience, timeoutMs);
    await selectTechnology(page, tech.technology, timeoutMs);

    await page.getByRole("button", { name: "Continue" }).click();
    await waitForSettle(page, timeoutMs);

    await page.screenshot({
      path: path.join(outDir, `add-data-step2-${tech.id}.png`),
      fullPage: true,
    });
    console.log(`  add-data-step2-${tech.id}`);
    captured += 1;

    if (!capturedStep3GuideTypes.has(tech.guideType)) {
      capturedStep3GuideTypes.add(tech.guideType);

      await page.getByRole("button", { name: "Continue" }).click();
      await waitForSettle(page, timeoutMs);

      await page.screenshot({
        path: path.join(outDir, `add-data-step3-${tech.id}.png`),
        fullPage: true,
      });
      console.log(`  add-data-step3-${tech.id}`);
      captured += 1;
    }
  }

  return captured;
}
