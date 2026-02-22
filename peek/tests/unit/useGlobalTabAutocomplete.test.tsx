import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import { useGlobalTabAutocomplete } from "../../src/hooks/useGlobalTabAutocomplete";
import { useLLMStore } from "../../src/store/useLLMStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

function TestHarness() {
  useGlobalTabAutocomplete();
  const [value, setValue] = useState("show me ");
  return (
    <input
      aria-label="free text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => {
        const target = event.currentTarget;
        target.setSelectionRange(target.value.length, target.value.length);
      }}
    />
  );
}

describe("useGlobalTabAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().setTabAutocompleteEnabled(true);

    const modelFactory = Object.assign((model: string) => ({ model, adapter: "responses" }), {
      chat: (model: string) => ({ model, adapter: "chat" }),
    });
    vi.mocked(createOpenAI).mockReturnValue(modelFactory as never);
  });

  it("applies completion when pressing Tab in a text box", async () => {
    const user = userEvent.setup();
    vi.mocked(generateText).mockResolvedValue({ text: " elasticsearch logs" } as never);

    render(<TestHarness />);

    const input = screen.getByLabelText("free text");
    await user.click(input);
    await user.keyboard("{Tab}");

    await waitFor(() => {
      expect(screen.getByDisplayValue("show me elasticsearch logs")).toBeInTheDocument();
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("does not request completion when feature is disabled", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setTabAutocompleteEnabled(false);

    render(<TestHarness />);
    const input = screen.getByLabelText("free text");
    await user.click(input);
    await user.keyboard("{Tab}");

    expect(generateText).not.toHaveBeenCalled();
  });

  it("discards completion when text changed while request was in flight", async () => {
    const user = userEvent.setup();
    let resolveGenerate: (value: { text: string }) => void;
    vi.mocked(generateText).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve as typeof resolveGenerate;
        }),
    );

    render(<TestHarness />);
    const input = screen.getByLabelText("free text") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{Tab}");

    // Simulate user typing while the request is in flight
    await user.type(input, "extra ");

    // Now resolve the stale completion
    resolveGenerate!({ text: " elasticsearch logs" } as never);

    // Wait a tick to let the .then() handler run
    await new Promise((r) => setTimeout(r, 0));

    // The completion should NOT have been applied because text changed
    expect(input.value).toBe("show me extra ");
  });
});
