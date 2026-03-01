import { describe, expect, it } from "vitest";

import { storeResetters } from "../../src/store/storeResetters";
import { useTracesStore } from "../../src/store/useTracesStore";

describe("global reset reproduction for traces store", () => {
  it("restores traces view mode and drawer state", () => {
    useTracesStore.getState().setViewMode("serviceMap");
    useTracesStore.getState().setSelectedSpanId("span-1");

    for (const reset of storeResetters) {
      reset();
    }

    const state = useTracesStore.getState();
    expect(state.viewMode).toBe("list");
    expect(state.drawerOpen).toBe(false);
  });
});
