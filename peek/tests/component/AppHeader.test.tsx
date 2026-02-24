import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AppHeader from "../../src/components/AppHeader";
import { PAGE_MANIFEST } from "../../src/routes/manifest";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function renderHeader(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe("AppHeader", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    // Set connected so the dashboard title and controls are visible
    useConnectionStore.getState().setConnected(true);
  });

  it("renders the Peek branding", () => {
    renderHeader();

    expect(screen.getByText("Peek")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Peek" })).toBeInTheDocument();
  });

  it("shows Add Panel button on a dashboard view page", () => {
    const dashboardId = useDashboardStore.getState().activeDashboardId;
    renderHeader(`/dashboards/${dashboardId}`);

    expect(screen.getByRole("button", { name: /add panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
  });

  it("hides Add Panel button on non-dashboard pages", () => {
    renderHeader(PAGE_MANIFEST.discover.path);

    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("shows time controls on query pages", () => {
    renderHeader(PAGE_MANIFEST.discover.path);

    const headerButtons = screen.getAllByRole("button");
    expect(headerButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("shows time controls on metrics page", () => {
    renderHeader(PAGE_MANIFEST.explore.path);

    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("hides time controls on non-time pages", () => {
    renderHeader(PAGE_MANIFEST.settings.path);

    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();
  });

  it("hides time controls on docs and chat pages", () => {
    const { rerender } = renderHeader(PAGE_MANIFEST.docs.path);
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={[PAGE_MANIFEST.chat.path]}>
        <AppHeader />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();
  });

  it("shows time controls for routes configured with showTimeControls", () => {
    const timeControlRoutes = Object.values(PAGE_MANIFEST)
      .filter((page) => page.showTimeControls)
      .map((page) => page.path);

    const { rerender } = renderHeader(timeControlRoutes[0]);
    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();

    for (const route of timeControlRoutes.slice(1)) {
      rerender(
        <MemoryRouter key={route} initialEntries={[route]}>
          <AppHeader />
        </MemoryRouter>,
      );
      expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
    }
  });
});

describe("AppHeader profile health badges", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useConnectionStore.getState().setConnected(true);
  });

  it("shows a re-test button for each profile in the switcher menu", async () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setActiveProfileId(id!);

    renderHeader();

    // Open the profile menu
    fireEvent.click(screen.getByRole("button", { name: /switch connection profile/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /re-test dev/i })).toBeInTheDocument();
    });
  });

  it("shows health badge for a healthy profile in the switcher menu", async () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setActiveProfileId(id!);
    useConnectionStore.getState().setProfileHealth(id!, {
      status: "healthy",
      checkedAt: new Date().toISOString(),
      errorSummary: null,
    });

    renderHeader();

    // Open the profile menu
    fireEvent.click(screen.getByRole("button", { name: /switch connection profile/i }));

    await waitFor(() => {
      // CheckCircleIcon is rendered by MUI with data-testid="CheckCircleIcon"
      expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
    });
  });
});
