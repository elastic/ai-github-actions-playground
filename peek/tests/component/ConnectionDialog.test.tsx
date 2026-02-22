import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionDialog from "../../src/components/ConnectionDialog";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

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
    useDashboardStore.getState().resetState();
    // Open the dialog for all tests
    useDashboardStore.getState().setConnectionDialogOpen(true);
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
    expect(useDashboardStore.getState().connected).toBe(true);
    expect(useDashboardStore.getState().connectionDialogOpen).toBe(false);
  });

  it("shows an error when test connection fails", async () => {
    const user = userEvent.setup();
    getClusterInfoMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    render(<ConnectionDialog />);

    await user.type(screen.getByLabelText(/elasticsearch url/i), "https://localhost:9200");
    await user.click(screen.getByRole("button", { name: /^test$/i }));

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });
});
