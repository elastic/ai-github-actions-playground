import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { useDashboardFromUrl } from "../../src/hooks/useDashboardFromUrl";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

function makeWrapper(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboards/:id" element={children} />
          <Route path="/dashboards" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe("useDashboardFromUrl", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("returns found=true and sets active dashboard when id matches", () => {
    const id = useDashboardStore.getState().activeDashboardId;

    const { result } = renderHook(() => useDashboardFromUrl(), {
      wrapper: makeWrapper(`/dashboards/${id}`),
    });

    expect(result.current.found).toBe(true);
    expect(result.current.dashboardId).toBe(id);
  });

  it("returns found=false for an unknown dashboard id", () => {
    const { result } = renderHook(() => useDashboardFromUrl(), {
      wrapper: makeWrapper("/dashboards/does-not-exist"),
    });

    expect(result.current.found).toBe(false);
    expect(result.current.dashboardId).toBe("does-not-exist");
  });

  it("returns found=false when no id param is present", () => {
    const { result } = renderHook(() => useDashboardFromUrl(), {
      wrapper: makeWrapper("/dashboards"),
    });

    expect(result.current.found).toBe(false);
    expect(result.current.dashboardId).toBeUndefined();
  });

  it("syncs the active dashboard in the store", () => {
    const originalId = useDashboardStore.getState().activeDashboardId;
    // createDashboard switches active to the new one, so active is now newId
    useDashboardStore.getState().createDashboard("Second");
    expect(useDashboardStore.getState().activeDashboardId).not.toBe(originalId);

    // Navigate to the original — hook should switch active back
    renderHook(() => useDashboardFromUrl(), {
      wrapper: makeWrapper(`/dashboards/${originalId}`),
    });

    expect(useDashboardStore.getState().activeDashboardId).toBe(originalId);
  });
});
