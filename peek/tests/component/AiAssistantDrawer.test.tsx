import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AiAssistantDrawer from "../../src/components/AiAssistantDrawer";
import { useUIStore } from "../../src/store/useUIStore";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

function renderDrawer() {
  return render(
    <MemoryRouter>
      <AiAssistantDrawer />
    </MemoryRouter>,
  );
}

describe("AiAssistantDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("starts with aiPanelOpen as false", () => {
    renderDrawer();

    expect(useUIStore.getState().aiPanelOpen).toBe(false);
    expect(screen.queryByPlaceholderText("Type a message…")).not.toBeInTheDocument();
  });

  it("renders chat content when aiPanelOpen is true", () => {
    useUIStore.getState().setAiPanelOpen(true);
    useLLMStore.getState().setApiKey("sk-test-key");
    renderDrawer();

    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: /close ai assistant panel/i }));

    expect(useUIStore.getState().aiPanelOpen).toBe(false);
  });

  it("has the close button accessible", () => {
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    expect(screen.getByRole("button", { name: /close ai assistant panel/i })).toBeInTheDocument();
  });

  it("renders AI Assistant heading when open", () => {
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("renders explain mode toggle and toggles explain mode state", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    const toggle = screen.getByRole("button", { name: /toggle explain mode/i });
    expect(toggle).toBeInTheDocument();
    expect(useUIStore.getState().explainModeActive).toBe(false);

    await user.click(toggle);
    expect(useUIStore.getState().explainModeActive).toBe(true);

    await user.click(toggle);
    expect(useUIStore.getState().explainModeActive).toBe(false);
  });

  it("deactivates explain mode when drawer closes", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setAiPanelOpen(true);
    useUIStore.getState().setExplainModeActive(true);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: /close ai assistant panel/i }));

    expect(useUIStore.getState().aiPanelOpen).toBe(false);
    expect(useUIStore.getState().explainModeActive).toBe(false);
  });

  it("disables clear button when there are no messages", () => {
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });

  it("enables clear button when messages exist and clears messages", async () => {
    const user = userEvent.setup();
    useUIStore.getState().setAiPanelOpen(true);
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "hello" });
    renderDrawer();

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeEnabled();

    await user.click(clearButton);

    expect(useLLMStore.getState().messages).toEqual([]);
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });

  it("renders drawer paper with complementary role when open", () => {
    useUIStore.getState().setAiPanelOpen(true);
    renderDrawer();

    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });
});
