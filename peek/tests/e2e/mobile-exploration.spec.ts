import { test, expect, devices, type Page } from "@playwright/test";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

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

test.describe("Mobile Exploration @mobile", () => {
  test.use({ ...devices["iPhone 14"] });

  test("should render correctly on mobile", async ({ page }) => {
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
  });

  test("sidebar and header should be visible on mobile after connection", async ({ page }) => {
    await connectToMockCluster(page);

    const sidebar = page.getByRole("navigation", { name: "Main navigation" });
    await expect(sidebar).toBeVisible();

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
  });
});
