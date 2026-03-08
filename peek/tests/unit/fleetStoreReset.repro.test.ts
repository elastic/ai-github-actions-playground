// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { resetAllStores } from "../fixtures/test-utils";
import { useFleetFiltersStore } from "../../src/store/useFleetFiltersStore";

describe("fleet store reset reproduction", () => {
  it("global reset should restore fleet tab and auto-refresh defaults", () => {
    useFleetFiltersStore.setState({
      fleetActiveTab: "agents",
      fleetAutoRefreshEnabled: false,
      agentFilter: {
        search: "agent-1",
        version: "8.15.0",
        hasErrors: true,
        staleness: "stale",
      },
    });

    resetAllStores();

    const state = useFleetFiltersStore.getState();
    expect(state.agentFilter).toEqual({
      search: "",
      version: null,
      hasErrors: false,
      staleness: null,
    });
    expect(state.fleetActiveTab).toBe("overview");
    expect(state.fleetAutoRefreshEnabled).toBe(true);
  });
});
