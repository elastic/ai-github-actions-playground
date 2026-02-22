import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("App shell visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
  });

  it("hides navigation and shows footer reset when disconnected", () => {
    render(<App />);

    expect(screen.queryByRole("navigation", { name: /main navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset state/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is settings", () => {
    useDashboardStore.getState().setCurrentPage("settings");
    render(<App />);

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText(/llm settings/i)).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is dashboard management", () => {
    useDashboardStore.getState().setCurrentPage("dashboardManagement");
    render(<App />);

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Management")).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is cluster overview", () => {
    useDashboardStore.getState().setCurrentPage("clusterOverview");
    render(<App />);

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText("Cluster Overview")).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is console", () => {
    useDashboardStore.getState().setCurrentPage("console");
    render(<App />);

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText(/api console/i)).not.toBeInTheDocument();
  });

  it("shows navigation and keeps footer reset when connected", () => {
    useDashboardStore.getState().setConnected(true);
    render(<App />);

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset state/i })).toBeInTheDocument();
  });
});
