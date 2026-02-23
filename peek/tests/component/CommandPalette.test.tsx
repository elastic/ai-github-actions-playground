import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import CommandPalette from "../../src/components/CommandPalette";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

/** Helper to capture the current router location inside tests. */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPalette(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CommandPalette />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
  });

  it("is hidden by default", () => {
    renderPalette();

    expect(screen.queryByLabelText("Command palette")).not.toBeInTheDocument();
  });

  it("opens when commandPaletteOpen is set to true", () => {
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByLabelText("Command palette")).toBeInTheDocument();
    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
  });

  it("shows navigation commands when connected", () => {
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Query Lab")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Console")).toBeInTheDocument();
  });

  it("hides connection-required nav commands when disconnected", () => {
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.queryByText("Cluster Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Streams")).not.toBeInTheDocument();
  });

  it("filters commands based on search input", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "query");

    expect(screen.getByText("Query Lab")).toBeInTheDocument();
    expect(screen.queryByText("Traces")).not.toBeInTheDocument();
  });

  it("shows 'No matching commands' when nothing matches", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "zzzznonexistent");

    await waitFor(() => {
      expect(screen.getByText("No matching commands")).toBeInTheDocument();
    });
  });

  it("navigates to a page when a command is clicked", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Query Lab"));

    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
    expect(useDashboardStore.getState().commandPaletteOpen).toBe(false);
  });

  it("shows action commands", () => {
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Connection Settings")).toBeInTheDocument();
    expect(screen.getByText("Switch to Light Mode")).toBeInTheDocument();
  });

  it("opens connection dialog when Connection Settings is clicked", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Connection Settings"));

    expect(useDashboardStore.getState().connectionDialogOpen).toBe(true);
    expect(useDashboardStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggles theme when theme command is clicked", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(useDashboardStore.getState().themeMode).toBe("dark");
    await user.click(screen.getByText("Switch to Light Mode"));

    expect(useDashboardStore.getState().themeMode).toBe("light");
  });

  it("shows recent queries when available", () => {
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("FROM logs-* | LIMIT 10")).toBeInTheDocument();
    expect(screen.getByText("Recent Queries")).toBeInTheDocument();
  });

  it("navigates to Query Lab with draft when a recent query is clicked", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("FROM logs-* | LIMIT 10"));

    expect(useDashboardStore.getState().discoverQueryDraft).toBe("FROM logs-* | LIMIT 10");
    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
    expect(useDashboardStore.getState().commandPaletteOpen).toBe(false);
  });

  it("opens with Ctrl+K keyboard shortcut", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(screen.queryByLabelText("Command palette")).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");

    expect(screen.getByLabelText("Command palette")).toBeInTheDocument();
  });

  it("excludes the current page from navigation commands", () => {
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setCommandPaletteOpen(true);
    renderPalette("/discover");

    // Query Lab maps to /discover — should not appear since we're on that page
    expect(screen.queryByText("Query Lab")).not.toBeInTheDocument();
    // But other pages should appear
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
