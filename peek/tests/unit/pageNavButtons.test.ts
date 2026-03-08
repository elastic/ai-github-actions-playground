import { describe, expect, it } from "vitest";

import { PAGE_PATHS } from "../../src/routes/paths";
import { PAGE_NAV_BUTTONS } from "../../scripts/page-nav-buttons.mjs";

// Keep this in sync with PAGE_NAV_BUTTONS and PAGE_PATHS; update all three when routes change.
const PAGE_TO_ROUTE_ID = {
  "add-data": "addData",
  "cluster-overview": "clusterOverview",
  profiling: "profiling",
  "data-streams": "dataStreams",
  indices: "indices",
  "ingest-pipelines": "ingestPipelines",
  investigate: "investigate",
  "query-lab": "discover",
  logs: "logs",
  metrics: "explore",
  services: "services",
  kubernetes: "kubernetes",
  traces: "traces",
  console: "console",
  users: "users",
  "api-keys": "apiKeys",
  roles: "roles",
  dashboards: "dashboards",
  fleet: "fleet",
  health: "clusterHealth",
  docs: "docs",
  tasks: "clusterTasks",
  ilm: "ilm",
  templates: "templates",
  transforms: "transforms",
  snapshots: "snapshots",
} as const;

describe("PAGE_NAV_BUTTONS", () => {
  it("keeps page key coverage in sync with the route mapping", () => {
    expect(Object.keys(PAGE_TO_ROUTE_ID).sort()).toEqual(Object.keys(PAGE_NAV_BUTTONS).sort());
  });

  it("matches sidebar nav labels from PAGE_PATHS", () => {
    for (const [pageKey, routeId] of Object.entries(PAGE_TO_ROUTE_ID)) {
      expect(
        PAGE_NAV_BUTTONS[pageKey as keyof typeof PAGE_NAV_BUTTONS],
        `${pageKey} label drifted from PAGE_PATHS.${routeId}.nav.label`,
      ).toBe(PAGE_PATHS[routeId as keyof typeof PAGE_PATHS].nav.label);
    }
  });
});
