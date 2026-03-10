// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShallow } from "zustand/react/shallow";

import { useDashboardEditorStore } from "../../src/store/useDashboardEditorStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

describe("repro: ExplorePage dashboard selector rerender", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "text" },
      value: "web",
    });
  });

  it("does not rerender when only a dashboard parameter value changes", () => {
    let renderCount = 0;

    renderHook(() => {
      renderCount += 1;
      const { timeRange } = useDashboardEditorStore(
        useShallow((s) => ({
          timeRange: s.dashboard.timeRange,
          setTimeRange: s.setTimeRange,
        })),
      );
      return timeRange;
    });

    expect(renderCount).toBe(1);

    act(() => {
      useDashboardStore.getState().setParameterValue("service", "api");
    });

    expect(renderCount).toBe(1);
  });
});
