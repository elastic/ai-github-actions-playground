import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SettingsPage from "../../src/components/SettingsPage";
import { useLLMStore } from "../../src/store/useLLMStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
  });

  it("renders the Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders LLM Provider section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("LLM Provider")).toBeInTheDocument();
  });

  it("renders API Key field", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
  });

  it("shows success alert when API key is configured", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<SettingsPage />);
    expect(screen.getByText("LLM provider is configured and ready to use.")).toBeInTheDocument();
  });

  it("does not show success alert when API key is empty", () => {
    render(<SettingsPage />);
    expect(
      screen.queryByText("LLM provider is configured and ready to use."),
    ).not.toBeInTheDocument();
  });

  it("toggle API key visibility button is present", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("button", { name: /toggle api key visibility/i })).toBeInTheDocument();
  });

  it("Reset LLM Settings button is present", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("button", { name: /reset llm settings/i })).toBeInTheDocument();
  });

  it("typing in API key field updates the store", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const input = screen.getByLabelText("API Key");
    await user.click(input);
    await user.type(input, "sk-new-key");
    expect(useLLMStore.getState().config.apiKey).toBe("sk-new-key");
  });

  it("includes OpenRouter in provider options", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByLabelText("Provider"));
    expect(screen.getByRole("option", { name: "OpenRouter" })).toBeInTheDocument();
  });

  it("toggles AI inline completions setting", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const toggle = screen.getByRole("checkbox", {
      name: /enable ai inline completions for code editors/i,
    });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(useLLMStore.getState().config.tabAutocompleteEnabled).toBe(true);
  });

  it("renders the Use custom model ID toggle", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("checkbox", { name: /use custom model id/i })).toBeInTheDocument();
  });

  it("custom model toggle is off by default and Model dropdown is shown", () => {
    render(<SettingsPage />);
    const toggle = screen.getByRole("checkbox", { name: /use custom model id/i });
    expect(toggle).not.toBeChecked();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
  });

  it("restores custom model mode when a persisted custom model ID is present", () => {
    useLLMStore.getState().setModel("gpt-4.5-preview");
    render(<SettingsPage />);
    const toggle = screen.getByRole("checkbox", { name: /use custom model id/i });
    expect(toggle).toBeChecked();
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
  });

  it("enabling custom model toggle switches to free-text Model ID input", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("checkbox", { name: /use custom model id/i }));
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
  });

  it("typing in custom Model ID input updates the store", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("checkbox", { name: /use custom model id/i }));
    const input = screen.getByLabelText("Model ID");
    await user.clear(input);
    await user.type(input, "gpt-4.5-preview");
    expect(useLLMStore.getState().config.model).toBe("gpt-4.5-preview");
  });

  it("shows validation error when custom Model ID is cleared", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("checkbox", { name: /use custom model id/i }));
    const input = screen.getByLabelText("Model ID");
    await user.clear(input);
    expect(screen.getByText("Model ID is required")).toBeInTheDocument();
  });

  it("disabling custom model toggle restores the Model dropdown", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const toggle = screen.getByRole("checkbox", { name: /use custom model id/i });
    await user.click(toggle);
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
  });

  it("changing provider resets custom model toggle to off", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("checkbox", { name: /use custom model id/i }));
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Provider"));
    await user.click(screen.getByRole("option", { name: "OpenRouter" }));
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });

  it("resetting LLM settings turns custom model mode off", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("checkbox", { name: /use custom model id/i }));
    expect(screen.getByLabelText("Model ID")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reset llm settings/i }));
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });

  it("toggles Elastic Docs search in chat setting", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const toggle = screen.getByRole("checkbox", {
      name: /enable elastic docs search in chat/i,
    });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(useLLMStore.getState().config.elasticDocsEnabled).toBe(true);
  });
});
