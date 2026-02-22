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

  it("theme toggle button is present and toggleable", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    // Default theme is "dark", so the toggle should show "Light mode" tooltip
    const themeButton = screen.getByRole("button", { name: /light mode/i });
    expect(themeButton).toBeInTheDocument();

    await user.click(themeButton);

    expect(useDashboardStore.getState().themeMode).toBe("light");

    // Now should show "Dark mode"
    expect(screen.getByRole("button", { name: /dark mode/i })).toBeInTheDocument();
  });

  it("shows Connected chip when connected", () => {
    render(<AppHeader />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Disconnected chip when not connected", () => {
    useDashboardStore.getState().setConnected(false);
    render(<AppHeader />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("does not warn when current page is dataStreams", () => {
    useDashboardStore.getState().setCurrentPage("dataStreams");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AppHeader />);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
