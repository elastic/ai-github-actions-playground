import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppHeader from "../../src/components/AppHeader";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("AppHeader", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
    // Set connected so the dashboard title and controls are visible
    useDashboardStore.getState().setConnected(true);
  });

  it("renders the dashboard title", () => {
    render(<AppHeader />);

    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders the Elastic Peek branding", () => {
    render(<AppHeader />);

    expect(screen.getByText("Elastic Peek")).toBeInTheDocument();
  });

  it("toggles theme from the settings menu", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: "Dark/Light Mode" }));

    expect(useDashboardStore.getState().themeMode).toBe("light");
  });

  it("opens LLM settings from the settings menu", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("menuitem", { name: "LLM Settings" }));

    expect(useDashboardStore.getState().currentPage).toBe("settings");
  });

  it("does not render Chat in the settings menu", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole("button", { name: /settings/i }));

    expect(screen.queryByRole("menuitem", { name: "Chat" })).not.toBeInTheDocument();
  });
});
