import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConnectionDialog from "../../src/components/ConnectionDialog";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { resetAllStores } from "../fixtures/test-utils";

const { fetchCapabilitiesForConnectionMock } = vi.hoisted(() => ({
  fetchCapabilitiesForConnectionMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  fetchCapabilitiesForConnection: fetchCapabilitiesForConnectionMock,
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

// Mock fetch to prevent real network calls during connect/test
vi.stubGlobal("fetch", vi.fn());

describe("ConnectionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    // Open the dialog for all tests
    useUIStore.getState().setConnectionDialogOpen(true);
  });

  it("renders URL and API key fields", () => {
    render(<ConnectionDialog />);

    expect(screen.getByLabelText(/elasticsearch url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^api key$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /advanced connection settings/i }),
    ).toBeInTheDocument();
  });

  it('disables "Connect" button when URL is empty', () => {
    render(<ConnectionDialog />);

    const connectButton = screen.getByRole("button", { name: /^connect$/i });
    expect(connectButton).toBeDisabled();
  });

  it("keeps Connect/Test/Connect & Save disabled when only proxy URL is provided", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.click(screen.getByRole("button", { name: /advanced connection settings/i }));
    await user.type(screen.getByLabelText(/proxy url/i), "http://localhost:3000/_es");

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^test$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /connect & save/i })).toBeDisabled();
  });

  it("enables Connect button after entering a URL", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    const urlField = screen.getByLabelText(/elasticsearch url/i);
    await user.type(urlField, "https://localhost:9200");

    // Enabled with just a URL (supports unsecured clusters)
    const connectButton = screen.getByRole("button", { name: /^connect$/i });
    expect(connectButton).toBeEnabled();
  });

  it("enables buttons when URL is entered without any credentials (unsecured cluster)", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^test$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /connect & save/i })).toBeEnabled();
  });

  it("enables buttons when URL is entered without username/password (unsecured cluster)", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.click(screen.getByRole("tab", { name: /username/i }));

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^test$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /connect & save/i })).toBeEnabled();
  });

  it("enables buttons when URL and username/password are provided", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.click(screen.getByRole("tab", { name: /username/i }));
    await user.type(screen.getByLabelText(/^username$/i), "elastic");
    await user.type(screen.getByLabelText(/^password$/i), "changeme");

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^test$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /connect & save/i })).toBeEnabled();
  });

  it("connects successfully and closes the dialog", async () => {
    const user = userEvent.setup();
    fetchCapabilitiesForConnectionMock.mockResolvedValue({
      canManageDataStreams: true,
    });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.type(screen.getByLabelText(/^api key$/i), "test-api-key");
    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(fetchCapabilitiesForConnectionMock).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
  });

  it("connects to an unsecured cluster with only a URL", async () => {
    const user = userEvent.setup();
    fetchCapabilitiesForConnectionMock.mockResolvedValue({
      canManageDataStreams: false,
      canCreateApiKeys: false,
      canReadSecurityUsers: false,
      canReadSecurityRoles: false,
      canReadApiKeys: false,
    });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "http://localhost:9200");
    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(fetchCapabilitiesForConnectionMock).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
  });

  it("shows an error when test connection fails", async () => {
    const user = userEvent.setup();
    fetchCapabilitiesForConnectionMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.type(screen.getByLabelText(/^api key$/i), "bad-api-key");
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("shows Connect & Save button enabled after entering a URL and API key", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.type(screen.getByLabelText(/^api key$/i), "test-api-key");

    expect(screen.getByRole("button", { name: /connect & save/i })).toBeEnabled();
  });

  it("connects and saves a profile from the prompt", async () => {
    const user = userEvent.setup();
    fetchCapabilitiesForConnectionMock.mockResolvedValue({
      canManageDataStreams: true,
    });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://dev.example.com");
    await user.type(screen.getByLabelText(/^api key$/i), "dev-key");
    await user.click(screen.getByRole("button", { name: /advanced connection settings/i }));
    await user.type(screen.getByLabelText(/proxy url/i), "http://localhost:3000/_es");
    await user.click(screen.getByRole("button", { name: /^connect & save$/i }));
    await user.type(screen.getByLabelText(/profile name/i), "Dev Cluster");
    await user.click(screen.getByRole("button", { name: /confirm connect & save/i }));

    const profiles = useConnectionStore.getState().connectionProfiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Dev Cluster");
    expect(profiles[0].connection.url).toBe("https://dev.example.com");
    expect(profiles[0].connection.apiKey).toBe("dev-key");
    expect(profiles[0].connection.proxyUrl).toBe("http://localhost:3000/_es");
    expect(useConnectionStore.getState().connected).toBe(true);
  });

  it("does not connect and save from Enter when URL is missing", async () => {
    const user = userEvent.setup();
    fetchCapabilitiesForConnectionMock.mockResolvedValue({
      canManageDataStreams: true,
    });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/^api key$/i), "dev-key");
    // Buttons remain disabled without URL
    expect(screen.getByRole("button", { name: /^connect & save$/i })).toBeDisabled();

    expect(fetchCapabilitiesForConnectionMock).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
    expect(useConnectionStore.getState().connected).toBe(false);
  });

  it("displays saved profiles in the dialog", () => {
    useConnectionStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
      connectionProfiles: [
        { id: "p1", name: "Dev", connection: { url: "https://dev.example.com", apiKey: "key1" } },
        {
          id: "p2",
          name: "Prod",
          connection: { url: "https://prod.example.com", apiKey: "key2" },
        },
      ],
    });
    render(<ConnectionDialog />);

    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText("Prod")).toBeInTheDocument();
    expect(screen.getByText("Saved Profiles")).toBeInTheDocument();
  });

  it("closes the dialog when Disconnect is clicked", async () => {
    const user = userEvent.setup();
    useConnectionStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
      connected: true,
    });
    render(<ConnectionDialog />);

    const disconnectButton = screen.getByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    expect(useConnectionStore.getState().connected).toBe(false);
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
  });

  it("deletes a profile after confirmation", async () => {
    const user = userEvent.setup();
    useConnectionStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
      connectionProfiles: [
        { id: "p1", name: "Dev", connection: { url: "https://dev.example.com", apiKey: "key1" } },
      ],
    });
    render(<ConnectionDialog />);

    await user.click(screen.getByLabelText(/delete profile dev/i));
    // Profile should still exist after first click
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /^confirm delete$/i }));
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
  });
});
