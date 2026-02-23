import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AppHeader from "../../src/components/AppHeader";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function renderHeader(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe("AppHeader", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
    // Set connected so the dashboard title and controls are visible
    useDashboardStore.getState().setConnected(true);
  });

  it("renders the Peek branding", () => {
    renderHeader();

    expect(screen.getByText("Peek")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Peek" })).toBeInTheDocument();
  });

  it("shows Add Panel button on the dashboard page", () => {
    renderHeader("/");

    expect(screen.getByRole("button", { name: /add panel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
  });

  it("hides Add Panel button on non-dashboard pages", () => {
    renderHeader("/discover");

    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("shows time controls on query pages", () => {
    renderHeader("/discover");

    const headerButtons = screen.getAllByRole("button");
    expect(headerButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("shows time controls on metrics page", () => {
    renderHeader("/explore");

    expect(screen.getByRole("button", { name: /last \d+(m|h|d)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
  });

  it("hides time controls on non-time pages", () => {
    renderHeader("/settings");

    expect(screen.queryByRole("button", { name: /add panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();
  });

  it("hides time controls on docs and chat pages", () => {
    const { rerender } = renderHeader("/docs");
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/chat"]}>
        <AppHeader />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /last \d+(m|h|d)/i })).not.toBeInTheDocument();
  });
});
