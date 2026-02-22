import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders the Peek branding", () => {
    render(<AppHeader />);

    expect(screen.getByText("Peek")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Peek" })).toBeInTheDocument();
  });

  it("shows Add Panel button on the dashboard page", () => {
    useDashboardStore.getState().setCurrentPage("dashboard");
    render(<AppHeader />);

    expect(screen.getByRole("button", { name: /add panel/i })).toBeInTheDocument();
  });

  it("hides Add Panel button on non-dashboard pages", () => {
    useDashboardStore.getState().setCurrentPage("discover");
    render(<AppHeader />);

    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });
});
