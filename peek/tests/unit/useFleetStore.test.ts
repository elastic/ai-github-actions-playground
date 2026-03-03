import { describe, it, expect, beforeEach } from "vitest";

import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";

describe("usePageFiltersStore – fleet slice", () => {
  beforeEach(() => {
    usePageFiltersStore.setState({
      fleetActiveTab: "overview",
      agentFilter: { search: "", version: null, hasErrors: false, staleness: null },
      fleetAutoRefreshEnabled: true,
    });
  });

  describe("initial state", () => {
    it("starts with overview tab", () => {
      expect(usePageFiltersStore.getState().fleetActiveTab).toBe("overview");
    });

    it("starts with empty filter", () => {
      expect(usePageFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });

    it("starts with auto-refresh enabled", () => {
      expect(usePageFiltersStore.getState().fleetAutoRefreshEnabled).toBe(true);
    });
  });

  describe("setters", () => {
    it("setFleetAutoRefreshEnabled toggles auto-refresh", () => {
      usePageFiltersStore.getState().setFleetAutoRefreshEnabled(false);
      expect(usePageFiltersStore.getState().fleetAutoRefreshEnabled).toBe(false);
      usePageFiltersStore.getState().setFleetAutoRefreshEnabled(true);
      expect(usePageFiltersStore.getState().fleetAutoRefreshEnabled).toBe(true);
    });
  });

  describe("tab management", () => {
    it("setFleetActiveTab changes the tab", () => {
      usePageFiltersStore.getState().setFleetActiveTab("agents");
      expect(usePageFiltersStore.getState().fleetActiveTab).toBe("agents");
    });
  });

  describe("agent filter", () => {
    it("updateAgentFilter merges partial updates", () => {
      usePageFiltersStore.getState().updateAgentFilter({ search: "host" });
      expect(usePageFiltersStore.getState().agentFilter).toEqual({
        search: "host",
        version: null,
        hasErrors: false,
        staleness: null,
      });

      usePageFiltersStore.getState().updateAgentFilter({ version: "8.14.0" });
      expect(usePageFiltersStore.getState().agentFilter).toEqual({
        search: "host",
        version: "8.14.0",
        hasErrors: false,
        staleness: null,
      });
    });

    it("updateAgentFilter sets hasErrors and staleness", () => {
      usePageFiltersStore.getState().updateAgentFilter({ hasErrors: true, staleness: "critical" });
      expect(usePageFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: true,
        staleness: "critical",
      });
    });

    it("resetFleetFilters clears to defaults", () => {
      usePageFiltersStore.getState().updateAgentFilter({
        search: "test",
        version: "8.14.0",
        hasErrors: true,
        staleness: "critical",
      });
      usePageFiltersStore.getState().resetFleetFilters();
      expect(usePageFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });
  });
});
