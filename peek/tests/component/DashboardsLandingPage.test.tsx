import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import DashboardsLandingPage from "../../src/components/DashboardsLandingPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/dashboards"]}>
      <DashboardsLandingPage />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe("DashboardsLandingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("renders the heading and dashboard count", () => {
    renderLanding();

    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.getByText(/1 dashboard/)).toBeInTheDocument();
  });

  it("renders a card for each dashboard", () => {
    useDashboardStore.getState().createDashboard("Second");

    renderLanding();

    const dashboards = useDashboardStore.getState().dashboards;
    for (const d of dashboards) {
      expect(screen.getByText(d.title)).toBeInTheDocument();
    }
  });

  it("shows 'Active' chip on the active dashboard card", () => {
    renderLanding();

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("navigates to /dashboards/:id when a card is clicked", async () => {
    const user = userEvent.setup();
    renderLanding();

    const activeId = useDashboardStore.getState().activeDashboardId;
    const card = screen.getByText(useDashboardStore.getState().dashboard.title);
    await user.click(card);

    expect(screen.getByTestId("location")).toHaveTextContent(`/dashboards/${activeId}`);
  });

  it("opens kebab menu with action items", async () => {
    const user = userEvent.setup();
    renderLanding();

    const title = useDashboardStore.getState().dashboard.title;
    await user.click(screen.getByLabelText(`Actions for ${title}`));

    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows New Dashboard button in toolbar", () => {
    renderLanding();

    expect(screen.getByRole("button", { name: /new dashboard/i })).toBeInTheDocument();
  });

  it("shows import and export buttons in toolbar", () => {
    renderLanding();

    expect(screen.getByRole("button", { name: /^import$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import workspace/i })).toBeInTheDocument();
  });

  it("hides archived dashboards by default", () => {
    const id = useDashboardStore.getState().createDashboard("Archived One");
    useDashboardStore.getState().archiveDashboard(id, true);

    renderLanding();

    expect(screen.queryByText("Archived One")).not.toBeInTheDocument();
  });

  it("shows empty state when no dashboards exist", () => {
    // Delete all dashboards except the last (store prevents deleting last)
    // Create a scenario with zero visible dashboards by archiving all
    const state = useDashboardStore.getState();
    state.archiveDashboard(state.activeDashboardId, true);

    renderLanding();

    // All dashboards are archived, so with default filter they're hidden
    expect(screen.getByText("No dashboards yet")).toBeInTheDocument();
  });

  it("shows archived dashboards when toggle is clicked", async () => {
    const user = userEvent.setup();
    const id = useDashboardStore.getState().createDashboard("Hidden");
    useDashboardStore.getState().archiveDashboard(id, true);

    renderLanding();

    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show archived/i }));

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});
