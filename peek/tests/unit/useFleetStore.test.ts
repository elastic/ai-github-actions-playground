import { describe, it, expect, beforeEach } from "vitest";

import { useFleetStore } from "../../src/store/useFleetStore";

describe("useFleetStore", () => {
  beforeEach(() => {
    useFleetStore.setState({
      activeTab: "overview",
      agentFilter: { search: "", version: null, hasErrors: false, staleness: null },
      autoRefreshEnabled: true,
    });
  });

  describe("initial state", () => {
    it("starts with overview tab", () => {
      expect(useFleetStore.getState().activeTab).toBe("overview");
    });

    it("starts with empty filter", () => {
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });

    it("starts with auto-refresh enabled", () => {
      expect(useFleetStore.getState().autoRefreshEnabled).toBe(true);
    });
  });

  describe("setters", () => {
    it("setAutoRefreshEnabled toggles auto-refresh", () => {
      useFleetStore.getState().setAutoRefreshEnabled(false);
      expect(useFleetStore.getState().autoRefreshEnabled).toBe(false);
      useFleetStore.getState().setAutoRefreshEnabled(true);
      expect(useFleetStore.getState().autoRefreshEnabled).toBe(true);
    });
  });

  describe("tab management", () => {
    it("setActiveTab changes the tab", () => {
      useFleetStore.getState().setActiveTab("agents");
      expect(useFleetStore.getState().activeTab).toBe("agents");
    });
  });

  describe("agent filter", () => {
    it("updateAgentFilter merges partial updates", () => {
      useFleetStore.getState().updateAgentFilter({ search: "host" });
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "host",
        version: null,
        hasErrors: false,
        staleness: null,
      });

      useFleetStore.getState().updateAgentFilter({ version: "8.14.0" });
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "host",
        version: "8.14.0",
        hasErrors: false,
        staleness: null,
      });
    });

    it("updateAgentFilter sets hasErrors and staleness", () => {
      useFleetStore.getState().updateAgentFilter({ hasErrors: true, staleness: "critical" });
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: true,
        staleness: "critical",
      });
    });

    it("resetFilters clears to defaults", () => {
      useFleetStore.getState().updateAgentFilter({
        search: "test",
        version: "8.14.0",
        hasErrors: true,
        staleness: "critical",
      });
      useFleetStore.getState().resetFilters();
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
    });
  });
});
