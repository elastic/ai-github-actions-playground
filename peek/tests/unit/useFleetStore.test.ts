import { describe, it, expect, beforeEach } from "vitest";

import { useFleetFiltersStore } from "../../src/store/useFleetFiltersStore";

describe("useFleetFiltersStore", () => {
  beforeEach(() => {
    useFleetFiltersStore.setState({
      fleetActiveTab: "overview",
      agentFilter: { search: "", version: null, hasErrors: false, staleness: null },
      fleetAutoRefreshEnabled: true,
    });
  });

  describe("initial state", () => {
    it("starts with overview tab", () => {
      expect(useFleetFiltersStore.getState().fleetActiveTab).toBe("overview");
    });

    it("starts with empty filter", () => {
      expect(useFleetFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });

    it("starts with auto-refresh enabled", () => {
      expect(useFleetFiltersStore.getState().fleetAutoRefreshEnabled).toBe(true);
    });
  });

  describe("setters", () => {
    it("setFleetAutoRefreshEnabled toggles auto-refresh", () => {
      useFleetFiltersStore.getState().setFleetAutoRefreshEnabled(false);
      expect(useFleetFiltersStore.getState().fleetAutoRefreshEnabled).toBe(false);
      useFleetFiltersStore.getState().setFleetAutoRefreshEnabled(true);
      expect(useFleetFiltersStore.getState().fleetAutoRefreshEnabled).toBe(true);
    });
  });

  describe("tab management", () => {
    it("setFleetActiveTab changes the tab", () => {
      useFleetFiltersStore.getState().setFleetActiveTab("agents");
      expect(useFleetFiltersStore.getState().fleetActiveTab).toBe("agents");
    });
  });

  describe("agent filter", () => {
    it("updateAgentFilter merges partial updates", () => {
      useFleetFiltersStore.getState().updateAgentFilter({ search: "host" });
      expect(useFleetFiltersStore.getState().agentFilter).toEqual({
        search: "host",
        version: null,
        hasErrors: false,
        staleness: null,
      });

      useFleetFiltersStore.getState().updateAgentFilter({ version: "8.14.0" });
      expect(useFleetFiltersStore.getState().agentFilter).toEqual({
        search: "host",
        version: "8.14.0",
        hasErrors: false,
        staleness: null,
      });
    });

    it("updateAgentFilter sets hasErrors and staleness", () => {
      useFleetFiltersStore.getState().updateAgentFilter({ hasErrors: true, staleness: "critical" });
      expect(useFleetFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: true,
        staleness: "critical",
      });
    });

    it("resetFleetFilters clears to defaults", () => {
      useFleetFiltersStore.getState().updateAgentFilter({
        search: "test",
        version: "8.14.0",
        hasErrors: true,
        staleness: "critical",
      });
      useFleetFiltersStore.getState().resetFleetFilters();
      expect(useFleetFiltersStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });
  });
});
