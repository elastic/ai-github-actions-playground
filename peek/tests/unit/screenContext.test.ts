// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { buildDetailedScreenContext } from "../../src/services/screenContext";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { usePageContextStore } from "../../src/store/usePageContextStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useTracesStore } from "../../src/store/useTracesStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { resetAllStores } from "../fixtures/test-utils";

describe("buildDetailedScreenContext", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("returns basic page info for a known page", () => {
    const ctx = buildDetailedScreenContext("/discover");
    expect(ctx.page).toEqual({ label: "Query Lab", path: "/discover" });
  });

  it("falls back to pathname for unknown pages", () => {
    const ctx = buildDetailedScreenContext("/unknown-page");
    expect(ctx.page).toEqual({ label: "/unknown-page", path: "/unknown-page" });
  });

  it("includes query lab context when a draft query exists", () => {
    useQueryStore.getState().setDiscoverQueryDraft("FROM logs-* | LIMIT 10");
    const ctx = buildDetailedScreenContext("/discover");
    expect(ctx.queryLab).toBeDefined();
    expect(ctx.queryLab!.draftQuery).toBe("FROM logs-* | LIMIT 10");
  });

  it("includes query lab lastQuery from session", () => {
    const ctx = buildDetailedScreenContext("/discover");
    expect(ctx.queryLab).toBeDefined();
    expect(ctx.queryLab!.lastQuery).toBe("FROM logs-* | SORT @timestamp | LIMIT 50");
  });

  it("includes query lab when default session query exists (even without draft)", () => {
    const ctx = buildDetailedScreenContext("/discover");
    expect(ctx.queryLab).toBeDefined();
  });

  it("includes traces context when a trace is selected", () => {
    useTracesStore.getState().setSelectedTraceId("trace-123");
    const ctx = buildDetailedScreenContext("/traces");
    expect(ctx.traces).toBeDefined();
    expect(ctx.traces!.selectedTraceId).toBe("trace-123");
    expect(ctx.traces!.viewMode).toBe("list");
  });

  it("includes traces context when services filter is set", () => {
    useTracesStore.getState().updateFilters({ services: ["my-service"] });
    const ctx = buildDetailedScreenContext("/traces");
    expect(ctx.traces).toBeDefined();
    expect(ctx.traces!.filters.services).toEqual(["my-service"]);
  });

  it("omits traces context when no trace selected and no filters set", () => {
    const ctx = buildDetailedScreenContext("/traces");
    expect(ctx.traces).toBeUndefined();
  });

  it("includes traces context when operations filter is set", () => {
    useTracesStore.getState().updateFilters({ operations: ["GET /api"] });
    const ctx = buildDetailedScreenContext("/traces");
    expect(ctx.traces).toBeDefined();
    expect(ctx.traces!.filters.operations).toEqual(["GET /api"]);
  });

  it("includes traces context when duration filter is set", () => {
    useTracesStore.getState().updateFilters({ minDurationMs: 500 });
    const ctx = buildDetailedScreenContext("/traces");
    expect(ctx.traces).toBeDefined();
    expect(ctx.traces!.filters.minDurationMs).toBe(500);
  });

  it("includes metrics context when a metric is selected", () => {
    useExplorerStore.getState().setSelectedMetric("system.cpu.total.norm.pct");
    const ctx = buildDetailedScreenContext("/explore");
    expect(ctx.metrics).toBeDefined();
    expect(ctx.metrics!.selectedMetric).toBe("system.cpu.total.norm.pct");
  });

  it("omits metrics context when no metric is selected", () => {
    const ctx = buildDetailedScreenContext("/explore");
    expect(ctx.metrics).toBeUndefined();
  });

  it("includes dashboard context when an active dashboard exists", () => {
    const state = useDashboardStore.getState();
    const dash = state.dashboards.find((d) => d.id === state.activeDashboardId);
    expect(dash).toBeDefined();
    const ctx = buildDetailedScreenContext("/dashboards");
    expect(ctx.dashboard).toBeDefined();
    expect(ctx.dashboard!.title).toBe(dash!.title);
  });

  it("includes panel queries when include_data is true", () => {
    const state = useDashboardStore.getState();
    const dash = state.dashboards.find((d) => d.id === state.activeDashboardId);
    expect(dash).toBeDefined();
    expect(dash!.panels.length).toBeGreaterThan(0);
    const ctx = buildDetailedScreenContext("/dashboards", true);
    expect(ctx.dashboard).toBeDefined();
    const panelWithQuery = ctx.dashboard!.panels.find((p) => p.query);
    expect(panelWithQuery).toBeDefined();
  });

  it("omits panel queries when include_data is false", () => {
    const state = useDashboardStore.getState();
    const dash = state.dashboards.find((d) => d.id === state.activeDashboardId);
    expect(dash).toBeDefined();
    expect(dash!.panels.length).toBeGreaterThan(0);
    const ctx = buildDetailedScreenContext("/dashboards", false);
    expect(ctx.dashboard).toBeDefined();
    for (const panel of ctx.dashboard!.panels) {
      expect(panel.query).toBeUndefined();
    }
  });

  it("returns minimal context when all stores are in default state", () => {
    const ctx = buildDetailedScreenContext("/discover");
    // Default state should have page info and queryLab (default session query exists)
    // but no traces, no metrics
    expect(ctx.page).toBeDefined();
    expect(ctx.traces).toBeUndefined();
    expect(ctx.metrics).toBeUndefined();
  });

  it("includes result summary when include_data is true and result exists", () => {
    useQueryStore.getState().setDiscoverSessionResult({
      columns: [
        { name: "col1", type: "keyword" },
        { name: "col2", type: "long" },
      ],
      values: [
        ["a", 1],
        ["b", 2],
      ],
    });
    const ctx = buildDetailedScreenContext("/discover", true);
    expect(ctx.queryLab!.lastResultSummary).toEqual({ rowCount: 2, columnCount: 2 });
  });

  // ----------------------------------------------------------------
  // matchPath: dynamic route resolution
  // ----------------------------------------------------------------

  it("resolves fleet agent detail page via matchPath", () => {
    const ctx = buildDetailedScreenContext("/fleet/agents/agent-xyz");
    expect(ctx.page.label).toBe("Fleet Agent Detail");
    expect(ctx.page.path).toBe("/fleet/agents/agent-xyz");
  });

  // ----------------------------------------------------------------
  // Console context (read directly from ApiConsoleStore)
  // ----------------------------------------------------------------

  it("includes console context when entries exist", () => {
    useApiConsoleStore.getState().setEntries([
      { id: "1", method: "GET", path: "/_cluster/health", body: "" },
      { id: "2", method: "POST", path: "/_search", body: "{}" },
    ]);
    const ctx = buildDetailedScreenContext("/console");
    expect(ctx.console).toBeDefined();
    expect(ctx.console!.requestCount).toBe(2);
    expect(ctx.console!.lastMethod).toBe("POST");
    expect(ctx.console!.lastPath).toBe("/_search");
  });

  it("includes console context when only consoleDraft exists", () => {
    useApiConsoleStore.getState().setConsoleDraft({ method: "PUT", path: "/_bulk" });
    const ctx = buildDetailedScreenContext("/console");
    expect(ctx.console).toBeDefined();
    expect(ctx.console!.requestCount).toBe(0);
    expect(ctx.console!.lastMethod).toBe("PUT");
    expect(ctx.console!.lastPath).toBe("/_bulk");
  });

  it("prefers consoleDraft method/path over last entry", () => {
    useApiConsoleStore
      .getState()
      .setEntries([{ id: "1", method: "GET", path: "/_cat/indices", body: "" }]);
    useApiConsoleStore.getState().setConsoleDraft({ method: "DELETE", path: "/my-index" });
    const ctx = buildDetailedScreenContext("/console");
    expect(ctx.console!.lastMethod).toBe("DELETE");
    expect(ctx.console!.lastPath).toBe("/my-index");
  });

  it("omits console context when store is empty", () => {
    const ctx = buildDetailedScreenContext("/console");
    expect(ctx.console).toBeUndefined();
  });

  // ----------------------------------------------------------------
  // Page-published context sections (usePageContextStore)
  // ----------------------------------------------------------------

  it("includes clusterOverview when published", () => {
    usePageContextStore.getState().setPageSection("clusterOverview", {
      status: "green",
      nodeCount: 3,
      indexCount: 42,
      storeSize: "1.2 GB",
    });
    const ctx = buildDetailedScreenContext("/cluster-overview");
    expect(ctx.clusterOverview).toEqual({
      status: "green",
      nodeCount: 3,
      indexCount: 42,
      storeSize: "1.2 GB",
    });
  });

  it("includes clusterHealth when published", () => {
    usePageContextStore.getState().setPageSection("clusterHealth", {
      status: "yellow",
      unassignedShards: 5,
      pendingTasks: 2,
      activeTab: "nodes",
    });
    const ctx = buildDetailedScreenContext("/cluster-health");
    expect(ctx.clusterHealth).toEqual({
      status: "yellow",
      unassignedShards: 5,
      pendingTasks: 2,
      activeTab: "nodes",
    });
  });

  it("includes indices when published", () => {
    usePageContextStore.getState().setPageSection("indices", {
      selectedIndex: "logs-2024.01",
      totalIndices: 100,
      healthBreakdown: { green: 80, yellow: 15, red: 5 },
    });
    const ctx = buildDetailedScreenContext("/indices");
    expect(ctx.indices).toEqual({
      selectedIndex: "logs-2024.01",
      totalIndices: 100,
      healthBreakdown: { green: 80, yellow: 15, red: 5 },
    });
  });

  it("includes dataStreams when published", () => {
    usePageContextStore.getState().setPageSection("dataStreams", {
      selectedStream: "logs-nginx",
      totalStreams: 10,
    });
    const ctx = buildDetailedScreenContext("/data-streams");
    expect(ctx.dataStreams).toEqual({ selectedStream: "logs-nginx", totalStreams: 10 });
  });

  it("includes ingestPipelines when published", () => {
    usePageContextStore.getState().setPageSection("ingestPipelines", {
      selectedPipeline: "my-pipeline",
      totalPipelines: 5,
      processorCount: 3,
    });
    const ctx = buildDetailedScreenContext("/ingest-pipelines");
    expect(ctx.ingestPipelines).toEqual({
      selectedPipeline: "my-pipeline",
      totalPipelines: 5,
      processorCount: 3,
    });
  });

  it("includes fleet when published", () => {
    usePageContextStore.getState().setPageSection("fleet", {
      totalAgents: 50,
      healthyCount: 45,
      unhealthyCount: 5,
    });
    const ctx = buildDetailedScreenContext("/fleet");
    expect(ctx.fleet).toEqual({ totalAgents: 50, healthyCount: 45, unhealthyCount: 5 });
  });

  it("includes fleetAgent when published", () => {
    usePageContextStore.getState().setPageSection("fleetAgent", {
      agentId: "agent-001",
      hostname: "web-server-1",
      version: "8.12.0",
      errorCount: 2,
    });
    const ctx = buildDetailedScreenContext("/fleet/agents/agent-001");
    expect(ctx.fleetAgent).toEqual({
      agentId: "agent-001",
      hostname: "web-server-1",
      version: "8.12.0",
      errorCount: 2,
    });
  });

  it("includes security context when published", () => {
    usePageContextStore.getState().setPageSection("security", {
      pageType: "users",
      selectedItem: "elastic",
      totalItems: 5,
    });
    const ctx = buildDetailedScreenContext("/users");
    expect(ctx.security).toEqual({ pageType: "users", selectedItem: "elastic", totalItems: 5 });
  });

  it("does not leak security page context into non-security pages", () => {
    usePageContextStore.getState().setPageSection("security", {
      pageType: "users",
      selectedItem: "elastic",
      totalItems: 5,
    });
    const ctx = buildDetailedScreenContext("/cluster-overview");
    expect(ctx.security).toBeUndefined();
  });

  it("omits page context sections when nothing is published", () => {
    const ctx = buildDetailedScreenContext("/cluster-overview");
    expect(ctx.clusterOverview).toBeUndefined();
    expect(ctx.clusterHealth).toBeUndefined();
    expect(ctx.indices).toBeUndefined();
    expect(ctx.dataStreams).toBeUndefined();
    expect(ctx.ingestPipelines).toBeUndefined();
    expect(ctx.fleet).toBeUndefined();
    expect(ctx.fleetAgent).toBeUndefined();
    expect(ctx.security).toBeUndefined();
  });
});
