// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { buildDetailedScreenContext } from "../../src/services/screenContext";
import { useDashboardStore } from "../../src/store/useDashboardStore";
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
});
