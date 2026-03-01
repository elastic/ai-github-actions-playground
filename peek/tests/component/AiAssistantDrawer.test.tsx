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
});
