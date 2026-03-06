import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import App from "../../src/App";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("App shell visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("hides navigation when disconnected", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("navigation", { name: /main navigation/i })).not.toBeInTheDocument();
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

  it("shows welcome screen when disconnected and current page is cluster tasks", () => {
    render(
      <MemoryRouter initialEntries={["/cluster-tasks"]}>
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

  it("shows navigation when connected and does not show reset in footer", () => {
    useConnectionStore.getState().setConnected(true);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset state/i })).not.toBeInTheDocument();
  });

  it("shows an LLM key banner when connected without a key", () => {
    useConnectionStore.getState().setConnected(true);
    useLLMStore.getState().setApiKey("");

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/configure an llm key to enable ai features/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /configure key/i })).toBeInTheDocument();
  });

  it("hides the LLM key nudge when an API key is configured", () => {
    useConnectionStore.getState().setConnected(true);
    useLLMStore.getState().setApiKey("sk-test-key");

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText(/configure an llm key to enable ai features/i),
    ).not.toBeInTheDocument();
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

  it("sets document.title based on the current route", () => {
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <App />
      </MemoryRouter>,
    );

    expect(document.title).toBe("Docs — Elastic Peek");
  });

  it("falls back to Elastic Peek for unknown routes", () => {
    document.title = "Previous Title";
    render(
      <MemoryRouter initialEntries={["/unknown-page-that-does-not-exist"]}>
        <App />
      </MemoryRouter>,
    );

    // Unknown routes redirect to /dashboards, so title reflects Dashboards
    expect(document.title).toBe("Dashboards — Elastic Peek");
  });

  it("navigates to /dashboards after resetting all state from a dashboard view", async () => {
    const user = userEvent.setup();
    useConnectionStore.getState().setConnected(true);

    render(
      <MemoryRouter initialEntries={["/dashboards/stale-dashboard-id"]}>
        <App />
        <LocationDisplay />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/dashboards/stale-dashboard-id");

    // Open Settings menu and click "Reset All State…"
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(await screen.findByRole("menuitem", { name: /reset all state/i }));

    // Click the "Reset" button to confirm
    await user.click(await screen.findByRole("button", { name: "Reset" }));

    // After reset, the URL should be /dashboards (not the stale dashboard ID)
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboards");
  });
});
