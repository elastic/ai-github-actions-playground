import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WelcomeScreen from "../../src/components/WelcomeScreen";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("WelcomeScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
  });

  it('shows "Connect to Elasticsearch" button when disconnected', () => {
    render(<WelcomeScreen />);
    expect(
      screen.getByRole("button", { name: /connect to elasticsearch/i }),
    ).toBeInTheDocument();
  });

  it("clicking the button opens the connection dialog", async () => {
    const user = userEvent.setup();
    render(<WelcomeScreen />);

    await user.click(screen.getByRole("button", { name: /connect to elasticsearch/i }));

    expect(useDashboardStore.getState().connectionDialogOpen).toBe(true);
  });
});
