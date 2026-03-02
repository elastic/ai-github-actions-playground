import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import DashboardViewPage from "../../src/components/DashboardViewPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/components/DashboardGrid", () => ({
  default: () => <div data-testid="dashboard-grid">DashboardGrid</div>,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderViewPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/dashboards/${id}`]}>
      <Routes>
        <Route path="/dashboards/:id" element={<DashboardViewPage />} />
        <Route path="/dashboards" element={<div data-testid="landing">Landing</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe("DashboardViewPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("renders DashboardGrid when id matches an existing dashboard", () => {
    const id = useDashboardStore.getState().activeDashboardId;
    renderViewPage(id);

    expect(screen.getByTestId("dashboard-grid")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(`/dashboards/${id}`);
  });

  it("shows not-found empty state when id does not match any dashboard", () => {
    renderViewPage("nonexistent-id");

    expect(screen.queryByTestId("dashboard-grid")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard not found")).toBeInTheDocument();
    expect(
      screen.getByText("The dashboard you requested does not exist or may have been deleted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to dashboards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create dashboard/i })).toBeInTheDocument();
    // Stays on the same route instead of redirecting
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboards/nonexistent-id");
  });
});
