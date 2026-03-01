import { describe, expect, it } from "vitest";

import { storeResetters } from "../../src/store/storeResetters";
import { useFleetStore } from "../../src/store/useFleetStore";

describe("fleet reset repro", () => {
  it("global reset should restore Fleet autoRefreshEnabled to default true", () => {
    useFleetStore.setState({ autoRefreshEnabled: false, lastUpdatedAt: 123 });

    for (const reset of storeResetters) {
      reset();
    }

    expect(useFleetStore.getState().autoRefreshEnabled).toBe(true);
    expect(useFleetStore.getState().lastUpdatedAt).toBeNull();
  });
});
