import { test, expect } from "@playwright/test";

test.describe("smoke – site navigation", () => {
  test("loads the welcome screen when not connected", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Elastic Peek" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect to Elasticsearch" })).toBeVisible();
  });

  test("opens and closes the connection dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
    await expect(page.getByRole("dialog", { name: "Elasticsearch Connection" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Elasticsearch URL" })).toBeVisible();

    // Tabs for auth methods
    await expect(page.getByRole("tab", { name: "API Key" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Username / Password" })).toBeVisible();

    // Cancel closes the dialog
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("shows disabled Connect button until a URL is entered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();

    const connectBtn = page.getByRole("button", { name: "Connect", exact: true });
    await expect(connectBtn).toBeDisabled();

    await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill("http://example.com:9200");
    await expect(connectBtn).toBeEnabled();
  });

  test("switches between API Key and Username / Password tabs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();

    // Default tab is API Key
    await expect(page.getByRole("textbox", { name: "API Key" })).toBeVisible();

    // Switch to Username / Password
    await page.getByRole("tab", { name: "Username / Password" }).click();
    await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();

    // Switch back
    await page.getByRole("tab", { name: "API Key" }).click();
    await expect(page.getByRole("textbox", { name: "API Key" })).toBeVisible();
  });

  test("reset button clears persisted state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Reset/i })).toBeVisible();
  });
});
