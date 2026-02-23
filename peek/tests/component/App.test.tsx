import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("App shell visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("hides navigation and shows footer reset when disconnected", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("navigation", { name: /main navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset state/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is settings", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText(/llm settings/i)).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is dashboard management", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard-management"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Management")).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is cluster overview", () => {
    render(
      <MemoryRouter initialEntries={["/cluster-overview"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText("Cluster Overview")).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is console", () => {
    render(
      <MemoryRouter initialEntries={["/console"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByText(/api console/i)).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is chat", () => {
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /go to settings/i })).not.toBeInTheDocument();
  });

  it("shows navigation and keeps footer reset when connected", () => {
    useConnectionStore.getState().setConnected(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset state/i })).toBeInTheDocument();
  });
});
