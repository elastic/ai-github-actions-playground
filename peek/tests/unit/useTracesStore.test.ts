import { describe, it, expect, beforeEach } from "vitest";

import { useTracesStore } from "../../src/store/useTracesStore";
import { EMPTY_FILTERS } from "../../src/components/traces/traceQueryBuilder";
import type { Span } from "../../src/components/traces/traceUtils";

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: null,
    serviceName: "test-service",
    name: "test-op",
    kind: "SERVER",
    durationUs: 1000,
    status: "OK",
    timestamp: "2026-01-01T00:00:00.000Z",
    startTimeUs: new Date("2026-01-01T00:00:00.000Z").getTime() * 1000,
    attributes: {},
    ...overrides,
  };
}

describe("useTracesStore", () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  describe("filters", () => {
    it("starts with empty filters", () => {
      const { filters } = useTracesStore.getState();
      expect(filters).toEqual(EMPTY_FILTERS);
    });

    it("setFilters replaces all filters and clears rawQuery", () => {
      useTracesStore.getState().setRawQuery("FROM foo");
      const newFilters = { ...EMPTY_FILTERS, services: ["my-svc"] };
      useTracesStore.getState().setFilters(newFilters);

      const state = useTracesStore.getState();
      expect(state.filters.services).toEqual(["my-svc"]);
      expect(state.rawQuery).toBeNull();
    });

    it("updateFilters merges partial updates and clears rawQuery", () => {
      useTracesStore.getState().setRawQuery("FROM foo");
      useTracesStore.getState().updateFilters({ services: ["api-gw"], minDurationMs: 100 });

      const state = useTracesStore.getState();
      expect(state.filters.services).toEqual(["api-gw"]);
      expect(state.filters.minDurationMs).toBe(100);
      expect(state.filters.statusCodes).toEqual([]); // unchanged
      expect(state.rawQuery).toBeNull();
    });

    it("resetFilters clears filters, query, and selection", () => {
      useTracesStore.getState().updateFilters({ services: ["svc"] });
      useTracesStore.getState().setSelectedTraceId("trace-1");
      useTracesStore.getState().setSelectedTraceSpans([makeSpan()]);

      useTracesStore.getState().resetFilters();

      const state = useTracesStore.getState();
      expect(state.filters).toEqual(EMPTY_FILTERS);
      expect(state.rawQuery).toBeNull();
      expect(state.selectedTraceId).toBeNull();
      expect(state.selectedTraceSpans).toEqual([]);
      expect(state.selectedSpanId).toBeNull();
    });
  });

  describe("tag filters", () => {
    it("addTagFilter appends a tag and clears rawQuery", () => {
      useTracesStore.getState().setRawQuery("FROM foo");
      useTracesStore.getState().addTagFilter("http.method", "GET");

      const state = useTracesStore.getState();
      expect(state.filters.tags).toEqual([{ key: "http.method", value: "GET", exclude: false }]);
      expect(state.rawQuery).toBeNull();
    });

    it("addTagFilter supports exclude mode", () => {
      useTracesStore.getState().addTagFilter("http.status_code", "500", true);

      const { tags } = useTracesStore.getState().filters;
      expect(tags).toEqual([{ key: "http.status_code", value: "500", exclude: true }]);
    });

    it("removeTagFilter removes by index", () => {
      useTracesStore.getState().addTagFilter("a", "1");
      useTracesStore.getState().addTagFilter("b", "2");
      useTracesStore.getState().addTagFilter("c", "3");

      useTracesStore.getState().removeTagFilter(1);

      const { tags } = useTracesStore.getState().filters;
      expect(tags).toHaveLength(2);
      expect(tags[0]!.key).toBe("a");
      expect(tags[1]!.key).toBe("c");
    });
  });

  describe("rawQuery", () => {
    it("setRawQuery stores user-edited query", () => {
      useTracesStore.getState().setRawQuery("FROM custom-index");
      expect(useTracesStore.getState().rawQuery).toBe("FROM custom-index");
    });

    it("setRawQuery(null) clears the override", () => {
      useTracesStore.getState().setRawQuery("FROM x");
      useTracesStore.getState().setRawQuery(null);
      expect(useTracesStore.getState().rawQuery).toBeNull();
    });
  });

  describe("trace selection", () => {
    it("setSelectedTraceId clears span selection and closes drawer", () => {
      useTracesStore.getState().setSelectedSpanId("span-1");
      expect(useTracesStore.getState().drawerOpen).toBe(true);

      useTracesStore.getState().setSelectedTraceId("trace-2");

      const state = useTracesStore.getState();
      expect(state.selectedTraceId).toBe("trace-2");
      expect(state.selectedSpanId).toBeNull();
      expect(state.drawerOpen).toBe(false);
    });

    it("setSelectedTraceId(null) deselects", () => {
      useTracesStore.getState().setSelectedTraceId("t1");
      useTracesStore.getState().setSelectedTraceId(null);
      expect(useTracesStore.getState().selectedTraceId).toBeNull();
    });

    it("setSelectedTraceSpans stores spans", () => {
      const spans = [makeSpan({ spanId: "a" }), makeSpan({ spanId: "b" })];
      useTracesStore.getState().setSelectedTraceSpans(spans);
      expect(useTracesStore.getState().selectedTraceSpans).toHaveLength(2);
    });
  });

  describe("span selection and drawer", () => {
    it("setSelectedSpanId opens the drawer", () => {
      useTracesStore.getState().setSelectedSpanId("span-1");

      const state = useTracesStore.getState();
      expect(state.selectedSpanId).toBe("span-1");
      expect(state.drawerOpen).toBe(true);
    });

    it("setSelectedSpanId(null) closes drawer", () => {
      useTracesStore.getState().setSelectedSpanId("span-1");
      useTracesStore.getState().setSelectedSpanId(null);

      const state = useTracesStore.getState();
      expect(state.selectedSpanId).toBeNull();
      expect(state.drawerOpen).toBe(false);
    });

    it("setDrawerOpen(false) clears selectedSpanId", () => {
      useTracesStore.getState().setSelectedSpanId("span-1");
      useTracesStore.getState().setDrawerOpen(false);

      const state = useTracesStore.getState();
      expect(state.drawerOpen).toBe(false);
      expect(state.selectedSpanId).toBeNull();
    });

    it("setDrawerOpen(true) opens without changing spanId", () => {
      useTracesStore.getState().setDrawerOpen(true);
      const state = useTracesStore.getState();
      expect(state.drawerOpen).toBe(true);
      expect(state.selectedSpanId).toBeNull(); // not set
    });
  });

  describe("viewMode", () => {
    it("defaults to list", () => {
      expect(useTracesStore.getState().viewMode).toBe("list");
    });

    it("setViewMode updates the mode", () => {
      useTracesStore.getState().setViewMode("scatter");
      expect(useTracesStore.getState().viewMode).toBe("scatter");

      useTracesStore.getState().setViewMode("timeseries");
      expect(useTracesStore.getState().viewMode).toBe("timeseries");

      useTracesStore.getState().setViewMode("serviceMap");
      expect(useTracesStore.getState().viewMode).toBe("serviceMap");
    });
  });
});
