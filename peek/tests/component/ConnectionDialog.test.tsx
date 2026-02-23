import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConnectionDialog from "../../src/components/ConnectionDialog";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const getClusterInfoMock = vi.fn();
const getCapabilitiesMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: getClusterInfoMock,
    getCapabilities: getCapabilitiesMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

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
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
  });

  it('disables "Connect" button when URL is empty', () => {
    render(<ConnectionDialog />);

    const connectButton = screen.getByRole("button", { name: /^connect$/i });
    expect(connectButton).toBeDisabled();
  });

  it("enables Connect button after entering a URL", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    const urlField = screen.getByLabelText(/elasticsearch url/i);
    await user.type(urlField, "https://localhost:9200");

    const connectButton = screen.getByRole("button", { name: /^connect$/i });
    expect(connectButton).toBeEnabled();
  });

  it("connects successfully and closes the dialog", async () => {
    const user = userEvent.setup();
    getClusterInfoMock.mockResolvedValue({});
    getCapabilitiesMock.mockResolvedValue({ canUseEsql: true, canUseAsyncEsql: true });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(getClusterInfoMock).toHaveBeenCalledTimes(1);
    expect(getCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().connected).toBe(true);
    expect(useUIStore.getState().connectionDialogOpen).toBe(false);
  });

  it("shows an error when test connection fails", async () => {
    const user = userEvent.setup();
    getClusterInfoMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });

  it("shows Save Profile button after entering a URL", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");

    expect(screen.getByRole("button", { name: /save profile/i })).toBeInTheDocument();
  });

  it("saves a connection profile from the dialog using form values", async () => {
    const user = userEvent.setup();
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://dev.example.com");
    await user.type(screen.getByLabelText(/api key/i), "dev-key");
    await user.type(screen.getByLabelText(/profile name/i), "Dev Cluster");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    const profiles = useConnectionStore.getState().connectionProfiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Dev Cluster");
    expect(profiles[0].connection.url).toBe("https://dev.example.com");
    expect(profiles[0].connection.apiKey).toBe("dev-key");
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

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
  });
});
