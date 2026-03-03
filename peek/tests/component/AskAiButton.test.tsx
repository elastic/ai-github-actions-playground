import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AskAiButton from "../../src/components/AskAiButton";
import { useUIStore } from "../../src/store/useUIStore";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

describe("AskAiButton", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
  });

  it("renders nothing when no API key is configured", () => {
    render(<AskAiButton prompt="test prompt" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders button with default label when API key is set", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<AskAiButton prompt="test prompt" />);

    expect(screen.getByRole("button", { name: /ask ai/i })).toBeInTheDocument();
  });

  it("renders custom label", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<AskAiButton prompt="test prompt" label="Analyze this" />);

    expect(screen.getByRole("button", { name: /analyze this/i })).toBeInTheDocument();
  });

  it("opens AI panel and sets pending prompt on click", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<AskAiButton prompt="Explain cluster health" />);

    await user.click(screen.getByRole("button", { name: /ask ai/i }));

    expect(useUIStore.getState().aiPanelOpen).toBe(true);
    expect(useLLMStore.getState().pendingPrompt).toBe("Explain cluster health");
  });

  it("renders with medium size", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<AskAiButton prompt="test" size="medium" />);

    expect(screen.getByRole("button", { name: /ask ai/i })).toBeInTheDocument();
  });
});
