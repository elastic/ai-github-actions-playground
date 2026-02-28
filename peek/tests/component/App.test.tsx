import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
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
    expect(screen.queryByRole("button", { name: /reset llm settings/i })).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is dashboards", () => {
    render(
      <MemoryRouter initialEntries={["/dashboards"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new dashboard/i })).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is cluster overview", () => {
    render(
      <MemoryRouter initialEntries={["/cluster-overview"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });

  it("shows welcome screen when disconnected and current page is cluster health", () => {
    render(
      <MemoryRouter initialEntries={["/cluster-health"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /connect to elasticsearch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
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

  it("does not intercept undo shortcut inside contenteditable editors", () => {
    const undoSpy = vi.fn();
    const redoSpy = vi.fn();
    useDashboardStore.setState({ undoDashboardChange: undoSpy, redoDashboardChange: redoSpy });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    const editorRoot = document.createElement("div");
    editorRoot.setAttribute("contenteditable", "true");
    document.body.appendChild(editorRoot);
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    editorRoot.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    editorRoot.remove();
  });

  it("does not intercept shortcuts from CodeMirror editor roots", () => {
    const undoSpy = vi.fn();
    const redoSpy = vi.fn();
    useDashboardStore.setState({ undoDashboardChange: undoSpy, redoDashboardChange: redoSpy });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    const cmEditor = document.createElement("div");
    cmEditor.className = "cm-editor";
    const cmContent = document.createElement("div");
    cmContent.className = "cm-content";
    cmEditor.appendChild(cmContent);
    document.body.appendChild(cmEditor);
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    cmContent.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
    cmEditor.remove();
  });
});
