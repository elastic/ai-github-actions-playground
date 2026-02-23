import { describe, it, expect } from "vitest";

import { PAGE_MANIFEST, NAV_SECTION_ORDER, type PageId } from "../../src/routes/manifest";

const entries = Object.entries(PAGE_MANIFEST) as Array<[PageId, (typeof PAGE_MANIFEST)[PageId]]>;

describe("PAGE_MANIFEST", () => {
  it("every page has a unique path", () => {
    const paths = entries.map(([, config]) => config.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("every sidebar page belongs to a section in NAV_SECTION_ORDER", () => {
    for (const [page, config] of entries) {
      if (config.nav.showInSidebar) {
        expect(
          NAV_SECTION_ORDER,
          `${page} is in group "${config.nav.group}" which is not in NAV_SECTION_ORDER`,
        ).toContain(config.nav.group);
      }
    }
  });

  it("no two pages in the same nav group share an order value", () => {
    const seen = new Map<string, Map<number, string>>();
    for (const [page, config] of entries) {
      if (!config.nav.showInSidebar) continue;
      const group = config.nav.group;
      const orders = seen.get(group) ?? new Map<number, string>();
      expect(
        orders.has(config.nav.order),
        `${page} and ${orders.get(config.nav.order)} both have order ${config.nav.order} in "${group}"`,
      ).toBe(false);
      orders.set(config.nav.order, page);
      seen.set(group, orders);
    }
  });

  it("pages that don't require connection can render without Elasticsearch", () => {
    const noConnectionPages = entries.filter(([, config]) => !config.requiresConnection);
    expect(noConnectionPages.length).toBeGreaterThan(0);

    for (const [page] of noConnectionPages) {
      expect(
        PAGE_MANIFEST[page].nav.showInSidebar,
        `${page} doesn't require connection but is not reachable from sidebar`,
      ).toBe(true);
    }
  });

  it("only docs is accessible without a connection", () => {
    expect(PAGE_MANIFEST.docs.requiresConnection).toBe(false);
    expect(PAGE_MANIFEST.chat.requiresConnection).toBe(true);
  });

  it("every sidebar-visible manifest entry has a non-null icon", () => {
    for (const [page, config] of entries) {
      if (config.nav.showInSidebar) {
        expect(config.nav.icon, `${page} is sidebar-visible but has no icon`).toBeTruthy();
      }
    }
  });

  it("every page has a non-empty nav label", () => {
    for (const [page, config] of entries) {
      expect(config.nav.label.length, `${page} has an empty nav label`).toBeGreaterThan(0);
    }
  });

  it("every page has a path starting with /", () => {
    for (const [page, config] of entries) {
      expect(config.path.startsWith("/"), `${page} path "${config.path}" must start with /`).toBe(
        true,
      );
    }
  });
});
