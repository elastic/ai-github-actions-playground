import { test, expect, devices, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

const isCi = !["", "0", "false"].includes(process.env.CI ?? "");

async function connectToMockCluster(page: Page) {
  await registerElasticsearchMocks(page, {
    esUrl: DEFAULT_ES_URL,
    data: { clusterInfo: { cluster_name: "mobile-exploration-cluster" } },
  });
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
}

function skipDesktopChromiumInCi() {
  test.skip(
    isCi && test.info().project.name === "chromium",
    "Mobile suite should run only on mobile projects in CI.",
  );
}

if (!isCi) {
  const iPhone14 = devices["iPhone 14"];
  test.use({
    viewport: iPhone14.viewport,
    userAgent: iPhone14.userAgent,
    deviceScaleFactor: iPhone14.deviceScaleFactor,
    isMobile: iPhone14.isMobile,
    hasTouch: iPhone14.hasTouch,
  });
}

test.describe("Mobile Exploration @mobile", () => {
  test("should render correctly on mobile", async ({ page }) => {
    skipDesktopChromiumInCi();
    await page.goto("");

    // Check if the logo is visible and not too large for the viewport
    const logo = page.getByAltText("Peek");
    await expect(logo).toBeVisible();
    const logoBox = await logo.boundingBox();
    expect(logoBox?.width).toBeLessThanOrEqual(400);

    // Initial Welcome screen should be responsive
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();

    // Connect button should be visible and clickable
    const connectBtn = page.getByRole("button", { name: "Connect to Elasticsearch" });
    await expect(connectBtn).toBeVisible();

    // Click connect and check dialog responsiveness
    await connectBtn.click();
    const dialog = page.getByRole("dialog", { name: "Elasticsearch Connection" });
    await expect(dialog).toBeVisible();

    // The dialog should not overflow the viewport
    const dialogBox = await dialog.boundingBox();
    const viewport = page.viewportSize();
    if (dialogBox && viewport) {
      expect(dialogBox.width).toBeLessThanOrEqual(viewport.width);
    }

    // Axe accessibility scan on mobile welcome page
    const welcomeResults = await new AxeBuilder({ page }).analyze();
    const welcomeViolations = welcomeResults.violations.filter((v) => v.id === "color-contrast");
    expect(
      welcomeViolations,
      `Mobile welcome page has color-contrast violations: ${JSON.stringify(welcomeViolations, null, 2)}`,
    ).toHaveLength(0);
  });

  test("sidebar and header should be visible on mobile after connection", async ({ page }) => {
    skipDesktopChromiumInCi();
    await connectToMockCluster(page);
    await page.getByRole("button", { name: "Open navigation menu" }).click();

    const sidebar = page.getByRole("navigation", { name: "Main navigation" });
    await expect(sidebar).toBeVisible();

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();

    // Axe accessibility scan on mobile post-connect page
    const postConnectResults = await new AxeBuilder({ page }).analyze();
    const postConnectViolations = postConnectResults.violations.filter(
      (v) => v.id === "color-contrast",
    );
    expect(
      postConnectViolations,
      `Mobile post-connect page has color-contrast violations: ${JSON.stringify(postConnectViolations, null, 2)}`,
    ).toHaveLength(0);
  });
});
