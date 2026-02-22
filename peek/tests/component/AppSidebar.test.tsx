import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSidebar from "../../src/components/AppSidebar";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("AppSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
  });

  it("renders the main navigation landmark", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    render(<AppSidebar />);

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("renders Docs nav item regardless of connection state", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("button", { name: /docs/i })).toBeInTheDocument();
  });

  it("renders Chat nav item regardless of connection state", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument();
  });

  it("disables connection-required items when disconnected", () => {
    render(<AppSidebar />);

    const dashboardBtn = screen.getByRole("button", { name: /dashboard/i });
    expect(dashboardBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("enables all items when connected", () => {
    useDashboardStore.getState().setConnected(true);
    render(<AppSidebar />);

    expect(screen.getByRole("button", { name: /dashboard/i })).not.toHaveAttribute(
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
  });

  it("marks the active page with aria-current", () => {
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCurrentPage("dashboard");
    render(<AppSidebar />);

    const dashboardBtn = screen.getByRole("button", { name: /dashboard/i });
    expect(dashboardBtn).toHaveAttribute("aria-current", "page");
  });

  it("navigates to a page when a nav item is clicked", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /query lab/i }));

    expect(useDashboardStore.getState().currentPage).toBe("discover");
  });

  it("navigates to Docs when Docs item is clicked", async () => {
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /docs/i }));

    expect(useDashboardStore.getState().currentPage).toBe("docs");
  });

  it("navigates to Data Streams when clicked while connected", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /data streams/i }));

    expect(useDashboardStore.getState().currentPage).toBe("dataStreams");
  });

  it("navigates to Cluster Overview when clicked while connected", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /cluster overview/i }));

    expect(useDashboardStore.getState().currentPage).toBe("clusterOverview");
  });

  it("updates aria-current when active page changes", () => {
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCurrentPage("console");
    const { rerender } = render(<AppSidebar />);

    expect(screen.getByRole("button", { name: /console/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /dashboard/i })).not.toHaveAttribute("aria-current");

    useDashboardStore.getState().setCurrentPage("dashboard");
    rerender(<AppSidebar />);

    expect(screen.getByRole("button", { name: /dashboard/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /console/i })).not.toHaveAttribute("aria-current");
  });

  it("renders icon-only mode when collapsed and supports toggle", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    render(<AppSidebar collapsed onToggleCollapse={onToggleCollapse} />);

    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expand navigation/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("opens settings menu and navigates to LLM settings", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: /llm settings/i }));

    expect(useDashboardStore.getState().currentPage).toBe("settings");
  });

  it("opens settings menu and navigates to Dashboard Management", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: /dashboard management/i }));

    expect(useDashboardStore.getState().currentPage).toBe("dashboardManagement");
  });

  it("toggles theme from sidebar settings menu", async () => {
    useDashboardStore.getState().setConnected(true);
    const user = userEvent.setup();
    render(<AppSidebar />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: /dark\/light mode/i }));

    expect(useDashboardStore.getState().themeMode).toBe("light");
  });
});
