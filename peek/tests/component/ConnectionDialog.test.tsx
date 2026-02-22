import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectionDialog from "../../src/components/ConnectionDialog";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

// Mock fetch to prevent real network calls during connect/test
vi.stubGlobal("fetch", vi.fn());

describe("ConnectionDialog", () => {
  beforeEach(() => {
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
});
