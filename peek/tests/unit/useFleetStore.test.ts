import { describe, it, expect, beforeEach } from "vitest";

import { useFleetStore } from "../../src/store/useFleetStore";
import type {
  FleetServerStatusMetrics,
  FleetAgentVersionCount,
  FleetOutputHealth,
  ElasticAgentInfo,
} from "../../src/services/fleet";

describe("useFleetStore", () => {
  beforeEach(() => {
    useFleetStore.setState({
      serverStatus: null,
      agentVersions: [],
      outputHealth: [],
      agentInventory: [],
      agentInventoryTotal: 0,
      actions: [],
      actionResults: [],
      activeTab: "overview",
      agentFilter: { search: "", version: null, hasErrors: false, staleness: null },
      loading: false,
      error: null,
      partialErrors: [],
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

    it("starts with no data", () => {
      const state = useFleetStore.getState();
      expect(state.serverStatus).toBeNull();
      expect(state.agentVersions).toEqual([]);
      expect(state.agentInventory).toEqual([]);
      expect(state.agentInventoryTotal).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("setters", () => {
    it("setServerStatus updates server status", () => {
      const status: FleetServerStatusMetrics = {
        total: 10,
        healthy: 8,
        unhealthy: 1,
        offline: 1,
        updating: 0,
        inactive: 0,
        enrolled: 10,
        unenrolled: 0,
        unhealthyReason: { input: 1, output: 0, other: 0 },
        timestamp: "2026-01-01T00:00:00Z",
      };
      useFleetStore.getState().setServerStatus(status);
      expect(useFleetStore.getState().serverStatus).toEqual(status);
    });

    it("setAgentVersions updates versions", () => {
      const versions: FleetAgentVersionCount[] = [
        { version: "8.14.0", count: 5 },
        { version: "8.13.0", count: 3 },
      ];
      useFleetStore.getState().setAgentVersions(versions);
      expect(useFleetStore.getState().agentVersions).toEqual(versions);
    });

    it("setOutputHealth updates health", () => {
      const health: FleetOutputHealth[] = [
        { output: "default", state: "HEALTHY", message: "", timestamp: "2026-01-01T00:00:00Z" },
      ];
      useFleetStore.getState().setOutputHealth(health);
      expect(useFleetStore.getState().outputHealth).toEqual(health);
    });

    it("setAgentInventory updates inventory", () => {
      const agents: ElasticAgentInfo[] = [
        {
          agentId: "a1",
          hostname: "host1",
          version: "8.14.0",
          os: null,
          lastSeen: "2026-01-01T00:00:00Z",
          logCount: 100,
          errorCount: 2,
        },
      ];
      useFleetStore.getState().setAgentInventory(agents);
      expect(useFleetStore.getState().agentInventory).toEqual(agents);
    });

    it("setAgentInventoryTotal updates total", () => {
      useFleetStore.getState().setAgentInventoryTotal(750);
      expect(useFleetStore.getState().agentInventoryTotal).toBe(750);
    });

    it("setLoading toggles loading", () => {
      useFleetStore.getState().setLoading(true);
      expect(useFleetStore.getState().loading).toBe(true);
      useFleetStore.getState().setLoading(false);
      expect(useFleetStore.getState().loading).toBe(false);
    });

    it("setError stores error", () => {
      useFleetStore.getState().setError("something broke");
      expect(useFleetStore.getState().error).toBe("something broke");
    });

    it("setPartialErrors stores partial errors", () => {
      useFleetStore.getState().setPartialErrors(["a", "b"]);
      expect(useFleetStore.getState().partialErrors).toEqual(["a", "b"]);
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
      useFleetStore.setState({ autoRefreshEnabled: false, lastUpdatedAt: 123 });
      useFleetStore.getState().resetFilters();
      expect(useFleetStore.getState().agentFilter).toEqual({
        search: "",
        version: null,
        hasErrors: false,
        staleness: null,
      });
      expect(useFleetStore.getState().autoRefreshEnabled).toBe(true);
      expect(useFleetStore.getState().lastUpdatedAt).toBeNull();
    });
  });
});
