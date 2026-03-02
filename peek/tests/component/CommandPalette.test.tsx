import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import CommandPalette from "../../src/components/CommandPalette";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import * as esService from "../../src/services/es";
import { resetAllStores } from "../fixtures/test-utils";

/** Helper to capture the current router location inside tests. */
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
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
    resetAllStores();
  });

  it("is hidden by default", () => {
    renderPalette();

    expect(screen.queryByLabelText("Command palette")).not.toBeInTheDocument();
  });

  it("opens when commandPaletteOpen is set to true", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByLabelText("Command palette")).toBeInTheDocument();
    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
  });

  it("shows navigation commands when connected", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // These titles also appear in the Docs group, so use getAllByText
    expect(screen.getAllByText("Query Lab").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Metrics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Console").length).toBeGreaterThanOrEqual(1);
  });

  it("hides connection-required nav commands when disconnected", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // These titles still appear once from Docs shortcuts; the nav commands are hidden.
    // When disconnected: 1 instance each (docs only). When connected: 2 instances (nav + docs).
    expect(screen.queryAllByText("Cluster Overview")).toHaveLength(1);
    expect(screen.queryAllByText("Data Streams")).toHaveLength(1);
  });

  it("filters commands based on search input", async () => {
    const user = userEvent.setup();
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "query");

    // "Query Lab" appears from both Navigation and Docs groups after filtering
    expect(screen.getAllByText("Query Lab").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Traces")).not.toBeInTheDocument();
  });

  it("shows 'No matching commands' when nothing matches", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "zzzznonexistent");

    await waitFor(() => {
      expect(screen.getByText("No matching commands")).toBeInTheDocument();
    });
  });

  it("navigates to a page when a command is clicked", async () => {
    const user = userEvent.setup();
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // Navigation command appears first (before Docs), click the first "Query Lab"
    await user.click(screen.getAllByText("Query Lab")[0]);

    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("shows action commands", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Connection Settings")).toBeInTheDocument();
    expect(screen.getByText("Switch to Light Mode")).toBeInTheDocument();
  });

  it("opens connection dialog when Connection Settings is clicked", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Connection Settings"));

    expect(useUIStore.getState().connectionDialogOpen).toBe(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggles theme when theme command is clicked", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(useUIStore.getState().themeMode).toBe("dark");
    await user.click(screen.getByText("Switch to Light Mode"));

    expect(useUIStore.getState().themeMode).toBe("light");
  });

  it("shows recent queries when available", () => {
    useQueryStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("FROM logs-* | LIMIT 10")).toBeInTheDocument();
    expect(screen.getByText("Recent Queries")).toBeInTheDocument();
  });

  it("navigates to Query Lab with draft when a recent query is clicked", async () => {
    const user = userEvent.setup();
    useQueryStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("FROM logs-* | LIMIT 10"));

    expect(useQueryStore.getState().discoverQueryDraft).toBe("FROM logs-* | LIMIT 10");
    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("shows Docs group with section shortcuts", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // "Docs" appears as both a nav item label and a group heading
    expect(screen.getAllByText("Docs").length).toBeGreaterThanOrEqual(1);
    // First docs section title (unique to docs, not a nav label)
    expect(screen.getByText("About Elastic Peek")).toBeInTheDocument();
  });

  it("navigates to /docs?section=<id> when a docs command is clicked", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Connecting to Elasticsearch"));

    expect(screen.getByTestId("location")).toHaveTextContent("/docs?section=connecting");
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("filters docs commands by section title", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "keyboard");

    await waitFor(() => {
      expect(screen.getByText("Tips & Shortcuts")).toBeInTheDocument();
      expect(screen.queryByText("About Elastic Peek")).not.toBeInTheDocument();
    });
  });

  it("opens with Ctrl+K keyboard shortcut", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(screen.queryByLabelText("Command palette")).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");

    expect(screen.getByLabelText("Command palette")).toBeInTheDocument();
  });

  it("shows Toggle AI Assistant action command", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Toggle AI Assistant")).toBeInTheDocument();
  });

  it("opens AI panel when Toggle AI Assistant is clicked", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(useUIStore.getState().aiPanelOpen).toBe(false);
    await user.click(screen.getByText("Toggle AI Assistant"));

    expect(useUIStore.getState().aiPanelOpen).toBe(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggles AI panel open with Ctrl+Shift+A keyboard shortcut", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(useUIStore.getState().aiPanelOpen).toBe(false);

    await user.keyboard("{Control>}{Shift>}a{/Shift}{/Control}");

    expect(useUIStore.getState().aiPanelOpen).toBe(true);
  });

  it("toggles AI panel closed with Ctrl+Shift+A when already open", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setAiPanelOpen(true);
    renderPalette();

    expect(useUIStore.getState().aiPanelOpen).toBe(true);

    await user.keyboard("{Control>}{Shift>}a{/Shift}{/Control}");

    expect(useUIStore.getState().aiPanelOpen).toBe(false);
  });

  it("excludes the current page from navigation commands", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette("/discover");

    // Query Lab nav command is excluded when on /discover, but the Docs shortcut still shows it.
    // So exactly one "Query Lab" remains (from Docs group).
    expect(screen.queryAllByText("Query Lab")).toHaveLength(1);
    // But other pages should appear (may appear as both nav command and group heading)
    expect(screen.getAllByText("Dashboards").length).toBeGreaterThanOrEqual(1);
  });

  it("excludes parameterized and hidden routes from navigation commands", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // Fleet Agent Detail has showInSidebar: false and a parameterized path — must not appear
    expect(screen.queryByText("Fleet Agent Detail")).not.toBeInTheDocument();
    // Cluster Tasks has showInSidebar: false — must not appear as a Navigation command
    expect(screen.queryByText("Cluster Tasks")).not.toBeInTheDocument();
  });

  it("shows Favorite Dashboards group when a dashboard is favorited", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    const id = useDashboardStore.getState().activeDashboardId;
    useDashboardStore.getState().toggleFavoriteDashboard(id);

    renderPalette();

    expect(screen.getByText("Favorite Dashboards")).toBeInTheDocument();
  });

  it("does not show Favorite Dashboards group when no dashboard is favorited", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);

    renderPalette();

    expect(screen.queryByText("Favorite Dashboards")).not.toBeInTheDocument();
  });
});

describe("CommandPalette — Connection Profiles group", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("does not show Connection Profiles group when disconnected", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setActiveProfileId(id!);
    // Not connected
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.queryByText("Connection Profiles")).not.toBeInTheDocument();
  });

  it("does not show Connection Profiles group when no profiles exist", () => {
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.queryByText("Connection Profiles")).not.toBeInTheDocument();
  });

  it("shows Re-test command for the active profile", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setActiveProfileId(id!);
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Re-test Dev")).toBeInTheDocument();
    expect(screen.queryByText("Switch to Dev")).not.toBeInTheDocument();
  });

  it("shows Switch and Re-test commands for non-active profiles", () => {
    const id1 = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    const id2 = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "key2" });
    useConnectionStore.getState().setActiveProfileId(id1!);
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    // Active profile (Dev): only Re-test, no Switch
    expect(screen.queryByText("Switch to Dev")).not.toBeInTheDocument();
    expect(screen.getByText("Re-test Dev")).toBeInTheDocument();

    // Non-active profile (Prod): both Switch and Re-test
    expect(screen.getByText("Switch to Prod")).toBeInTheDocument();
    expect(screen.getByText("Re-test Prod")).toBeInTheDocument();

    void id2;
  });

  it("shows Connection Profiles group heading when profiles exist and connected", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Staging", { url: "https://staging.example.com", apiKey: "k" });
    const id2 = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "k2" });
    useConnectionStore.getState().setActiveProfileId(id!);
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Connection Profiles")).toBeInTheDocument();
    void id2;
  });

  it("filters profile commands by profile name", async () => {
    const user = userEvent.setup();
    const id1 = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "key2" });
    useConnectionStore.getState().setActiveProfileId(id1!);
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.type(screen.getByLabelText("Search commands"), "prod");

    await waitFor(() => {
      expect(screen.getByText("Switch to Prod")).toBeInTheDocument();
      expect(screen.getByText("Re-test Prod")).toBeInTheDocument();
      expect(screen.queryByText("Re-test Dev")).not.toBeInTheDocument();
    });
  });

  it("ignores a second switch command while a profile switch is in flight", async () => {
    const user = userEvent.setup();
    const id1 = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "key2" });
    useConnectionStore
      .getState()
      .saveConnectionProfile("QA", { url: "https://qa.example.com", apiKey: "key3" });
    useConnectionStore.getState().setActiveProfileId(id1!);
    useConnectionStore.getState().setConnected(true);
    useUIStore.getState().setCommandPaletteOpen(true);
    const switchPromise = new Promise<never>(() => {});
    const fetchCapsSpy = vi
      .spyOn(esService, "fetchCapabilitiesForConnection")
      .mockReturnValue(switchPromise);
    renderPalette();

    await user.click(screen.getByText("Switch to Prod"));
    useUIStore.getState().setCommandPaletteOpen(true);
    await user.click(screen.getByText("Switch to QA"));

    await waitFor(() => {
      expect(fetchCapsSpy).toHaveBeenCalledTimes(1);
    });
    fetchCapsSpy.mockRestore();
  });

  it("keeps the current profile active when switching to another profile fails", async () => {
    const user = userEvent.setup();
    const id1 = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "key" });
    const id2 = useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "key2" });
    useConnectionStore.getState().setActiveProfileId(id1!);
    useConnectionStore.getState().setConnection({ url: "https://dev.example.com", apiKey: "key" });
    useConnectionStore.getState().setConnected(true);
    useConnectionStore.getState().setCapabilities({
      canManageDataStreams: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
    });
    useUIStore.getState().setCommandPaletteOpen(true);
    const fetchCapsSpy = vi
      .spyOn(esService, "fetchCapabilitiesForConnection")
      .mockRejectedValue(new Error("switch failed"));
    renderPalette();

    await user.click(screen.getByText("Switch to Prod"));

    await waitFor(() => {
      expect(useUIStore.getState().connectionDialogOpen).toBe(true);
    });
    expect(useConnectionStore.getState().activeProfileId).toBe(id1);
    expect(useConnectionStore.getState().connection?.url).toBe("https://dev.example.com");
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useConnectionStore.getState().capabilities).toEqual({
      canManageDataStreams: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
    });
    expect(useConnectionStore.getState().profileHealthMap[id2!]?.status).toBe("needs_attention");

    fetchCapsSpy.mockRestore();
  });
});

describe("CommandPalette — Recent Commands group", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("does not show Recent Commands group when no commands have been executed", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.queryByText("Recent Commands")).not.toBeInTheDocument();
  });

  it("shows Recent Commands group after executing a command", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Connection Settings"));

    // Re-open the palette
    useUIStore.getState().setCommandPaletteOpen(true);

    await waitFor(() => {
      expect(screen.getByText("Recent Commands")).toBeInTheDocument();
    });
  });

  it("records executed command ID in the store", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    await user.click(screen.getByText("Connection Settings"));

    expect(useUIStore.getState().recentCommandIds).toContain("action:connection");
  });

  it("deduplicates repeated commands and moves them to the front", () => {
    useUIStore.getState().addRecentCommandId("action:connection");
    useUIStore.getState().addRecentCommandId("action:theme");
    useUIStore.getState().addRecentCommandId("action:connection");

    const ids = useUIStore.getState().recentCommandIds;
    expect(ids).toEqual(["action:connection", "action:theme"]);
  });

  it("limits recent commands to 5", () => {
    for (let i = 0; i < 7; i++) {
      useUIStore.getState().addRecentCommandId(`cmd:${i}`);
    }

    expect(useUIStore.getState().recentCommandIds).toHaveLength(5);
    expect(useUIStore.getState().recentCommandIds[0]).toBe("cmd:6");
  });

  it("hides Recent Commands group when search input is not empty", async () => {
    const user = userEvent.setup();
    useUIStore.getState().addRecentCommandId("action:connection");
    useUIStore.getState().setCommandPaletteOpen(true);
    renderPalette();

    expect(screen.getByText("Recent Commands")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search commands"), "theme");

    await waitFor(() => {
      expect(screen.queryByText("Recent Commands")).not.toBeInTheDocument();
    });
  });

  it("persists recent command IDs across store rehydration", () => {
    useUIStore.getState().addRecentCommandId("action:connection");
    useUIStore.getState().addRecentCommandId("action:theme");

    // Verify persistence config includes recentCommandIds
    const persisted = JSON.parse(localStorage.getItem("elastic-peek-ui") || "{}");
    expect(persisted.state.recentCommandIds).toEqual(["action:theme", "action:connection"]);
  });

  it("clears recent command IDs on resetUIState", () => {
    useUIStore.getState().addRecentCommandId("action:connection");
    expect(useUIStore.getState().recentCommandIds).toHaveLength(1);

    useUIStore.getState().resetUIState();
    expect(useUIStore.getState().recentCommandIds).toEqual([]);
  });
});
