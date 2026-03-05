import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

test("debug Services a11y", async ({ page }) => {
  test.setTimeout(60_000);
  await registerElasticsearchMocks(page, {
    esUrl: DEFAULT_ES_URL,
    data: { clusterInfo: { cluster_name: "debug-cluster" } },
    queryResolver: ({ query }) => {
      if (query?.toUpperCase().includes("METRICS")) return { columns: [], values: [] };
      return { columns: [], values: [] };
    },
  });
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("textbox", { name: "API Key" }).fill("test-api-key");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Elasticsearch Connection" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Metrics", exact: true })).toBeVisible();

  // Navigate to Services
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Service Performance" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const contrastViolations = results.violations.filter((v) => v.id === "color-contrast");
  for (const v of contrastViolations) {
    console.log(`Rule: ${v.id}, Impact: ${v.impact}, Nodes: ${v.nodes.length}`);
    for (const node of v.nodes) {
      console.log(`  Target: ${JSON.stringify(node.target)}`);
      console.log(`  HTML: ${node.html.substring(0, 200)}`);
      console.log(`  Message: ${node.any.map((c) => c.message).join("; ")}`);
    }
  }
  for (const v of results.violations) {
    console.log(`Violation: ${v.id} (${v.nodes.length} nodes, impact: ${v.impact})`);
  }
});
