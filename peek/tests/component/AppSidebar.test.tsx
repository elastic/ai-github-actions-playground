import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import AppSidebar from "../../src/components/AppSidebar";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

/** Helper to capture the current router location inside tests. */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSidebar(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppSidebar />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("renders the main navigation landmark", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    renderSidebar();

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("renders Docs nav item regardless of connection state", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: /docs/i })).toBeInTheDocument();
  });

  it("renders Chat nav item regardless of connection state", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument();
  });

  it("disables connection-required items when disconnected", () => {
    renderSidebar();

    const dashboardBtn = screen.getByRole("button", { name: /dashboards/i });
    expect(dashboardBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("enables all items when connected", () => {
    useConnectionStore.getState().setConnected(true);
    renderSidebar();

    expect(screen.getByRole("button", { name: /dashboards/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /query lab/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /metrics/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /console/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /data streams/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster overview/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster health/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster tasks/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster capacity/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster shards/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /cluster resilience/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /fleet/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /users/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /roles/i })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("marks the active page with aria-current", () => {
    useConnectionStore.getState().setConnected(true);
    renderSidebar("/dashboards");

    const dashboardBtn = screen.getByRole("button", { name: /dashboards/i });
    expect(dashboardBtn).toHaveAttribute("aria-current", "page");
  });

  it("navigates to a page when a nav item is clicked", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /query lab/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
  });

  it("navigates to Docs when Docs item is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /docs/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/docs");
  });

  it("navigates to Data Streams when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /data streams/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/data-streams");
  });

  it("navigates to Cluster Overview when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster overview/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-overview");
  });

  it("navigates to Cluster Health when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster health/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-health");
  });

  it("navigates to Cluster Tasks when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster tasks/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-tasks");
  });

  it("navigates to Cluster Capacity when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster capacity/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-capacity");
  });

  it("navigates to Cluster Shards when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster shards/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-shards");
  });

  it("navigates to Cluster Resilience when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /cluster resilience/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-resilience");
  });

  it("navigates to Fleet when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /fleet/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/fleet");
  });

  it("navigates to Users when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /users/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/users");
  });

  it("navigates to Roles when clicked while connected", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /roles/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/roles");
  });

  it("updates aria-current when active page changes", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar("/console");

    expect(screen.getByRole("button", { name: /console/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /dashboards/i })).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: /dashboards/i }));

    expect(screen.getByRole("button", { name: /dashboards/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /console/i })).not.toHaveAttribute("aria-current");
  });

  it("renders icon-only mode when collapsed and supports toggle", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    render(
      <MemoryRouter>
        <AppSidebar collapsed onToggleCollapse={onToggleCollapse} />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dashboards/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand navigation/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("opens settings menu and navigates to LLM settings", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: /llm settings/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
  });

  it("toggles theme from sidebar settings menu", async () => {
    useConnectionStore.getState().setConnected(true);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: /dark\/light mode/i }));

    expect(useUIStore.getState().themeMode).toBe("light");
  });
});
