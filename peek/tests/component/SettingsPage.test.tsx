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
});
