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

  it("shows dashboard actions when connected", () => {
    render(<AppHeader />);

    expect(screen.getByRole("button", { name: /dashboard actions/i })).toBeInTheDocument();
  });

  it("hides dashboard actions when disconnected", () => {
    useDashboardStore.getState().setConnected(false);
    render(<AppHeader />);

    expect(screen.queryByRole("button", { name: /dashboard actions/i })).not.toBeInTheDocument();
  });
});
