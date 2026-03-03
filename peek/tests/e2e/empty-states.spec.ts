import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

/**
 * Register mocks and connect to the mocked cluster.
 * Accepts optional `data` overrides for the mock setup.
 */
async function connectToMockCluster(page: Page, data: Record<string, unknown> = {}) {
  await registerElasticsearchMocks(page, {
    esUrl: DEFAULT_ES_URL,
    data,
    fallback: {},
  });
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Metrics", exact: true })).toBeVisible();
}

test.describe("empty state – data management pages", () => {
  test("Data Streams page shows polished empty state when no streams exist", async ({ page }) => {
    await connectToMockCluster(page, { dataStreams: { data_streams: [] } });
    await page.getByRole("button", { name: "Data Streams", exact: true }).click();
    await page.waitForLoadState("networkidle");

    const emptyHeading = page.getByText("No data streams found");
    await expect(emptyHeading).toBeVisible({ timeout: 5_000 });

    const emptyDescription = page.getByText(
      "Try adjusting your search or check that data streams exist in the cluster",
    );
    await expect(emptyDescription).toBeVisible();
  });

  test("Ingest Pipelines page shows polished empty state when search yields no results", async ({
    page,
  }) => {
    await connectToMockCluster(page);
    await page.getByRole("button", { name: "Ingest Pipelines", exact: true }).click();
    await page.waitForLoadState("networkidle");

    // Type a non-matching search term to trigger empty filtered list
    await page.getByPlaceholder("Search pipelines").fill("zzz-nonexistent-pipeline");

    const emptyHeading = page.getByText("No pipelines found");
    await expect(emptyHeading).toBeVisible({ timeout: 5_000 });

    const emptyDescription = page.getByText("Try adjusting your search");
    await expect(emptyDescription).toBeVisible();
  });
});
