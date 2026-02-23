import { describe, it, expect, beforeEach, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { generateText } from "ai";

import { useLLMStore } from "../../src/store/useLLMStore";
import {
  makeLLMCompletionExtension,
  recentEditsField,
  setLastQueryError,
  getLastQueryError,
  ESQL_SYNTAX_GUIDE,
} from "../../src/components/llmCompletionExtension";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => {
    const factory = Object.assign((model: string) => ({ model }), {
      chat: (model: string) => ({ model, adapter: "chat" }),
    });
    return factory;
  }),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("makeLLMCompletionExtension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    setLastQueryError(null);
  });

  it("returns a non-empty extension array", () => {
    const ext = makeLLMCompletionExtension({ prompt: "test prompt" });
    expect(Array.isArray(ext)).toBe(true);
    expect((ext as unknown[]).length).toBeGreaterThan(0);
  });

  it("does not call LLM when feature is disabled", () => {
    useLLMStore.getState().setApiKey("sk-test");
    useLLMStore.getState().setTabAutocompleteEnabled(false);

    const ext = makeLLMCompletionExtension({ prompt: "test" });
    expect(ext).toBeDefined();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not call LLM when API key is empty", () => {
    useLLMStore.getState().setTabAutocompleteEnabled(true);

    const ext = makeLLMCompletionExtension({ prompt: "test" });
    expect(ext).toBeDefined();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("accepts custom delay option", () => {
    const ext = makeLLMCompletionExtension({ prompt: "test", delay: 1000 });
    expect(ext).toBeDefined();
  });

  it("includes esqlGuide option", () => {
    const ext = makeLLMCompletionExtension({ prompt: "test", esqlGuide: true });
    expect(ext).toBeDefined();
  });
});

describe("recentEditsField", () => {
  it("starts with an empty edits list", () => {
    const state = EditorState.create({
      doc: "FROM logs-*",
      extensions: [recentEditsField],
    });
    expect(state.field(recentEditsField)).toEqual([]);
  });

  it("tracks deletions when text is removed", () => {
    const state = EditorState.create({
      doc: "FROM logs-* | WHERE host = 'a'",
      extensions: [recentEditsField],
    });

    // Delete " | WHERE host = 'a'" (positions 11-30)
    const tr = state.update({
      changes: { from: 11, to: 30, insert: "" },
    });

    const edits = tr.state.field(recentEditsField);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.deleted).toBe(" | WHERE host = 'a'");
  });

  it("does not track whitespace-only deletions", () => {
    const state = EditorState.create({
      doc: "FROM   logs",
      extensions: [recentEditsField],
    });

    // Delete the extra spaces (positions 4-7)
    const tr = state.update({
      changes: { from: 4, to: 7, insert: "" },
    });

    expect(tr.state.field(recentEditsField)).toEqual([]);
  });

  it("caps at MAX_RECENT_EDITS (5)", () => {
    let state = EditorState.create({
      doc: "abcdefghijklmnop",
      extensions: [recentEditsField],
    });

    // Make 6 deletions, one char at a time from the end
    for (let i = 0; i < 6; i++) {
      const len = state.doc.length;
      const tr = state.update({
        changes: { from: len - 1, to: len, insert: "" },
      });
      state = tr.state;
    }

    expect(state.field(recentEditsField)).toHaveLength(5);
  });

  it("tracks replacements as deletions", () => {
    const state = EditorState.create({
      doc: "FROM logs-* | STATS count()",
      extensions: [recentEditsField],
    });

    // Replace "STATS" with "EVAL"
    const tr = state.update({
      changes: { from: 14, to: 19, insert: "EVAL" },
    });

    const edits = tr.state.field(recentEditsField);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.deleted).toBe("STATS");
  });
});

describe("query error side channel", () => {
  beforeEach(() => {
    setLastQueryError(null);
  });

  it("starts as null", () => {
    expect(getLastQueryError()).toBeNull();
  });

  it("stores an error message", () => {
    setLastQueryError("line 3:40: extraneous input 'by'");
    expect(getLastQueryError()).toBe("line 3:40: extraneous input 'by'");
  });

  it("clears error when set to null", () => {
    setLastQueryError("some error");
    setLastQueryError(null);
    expect(getLastQueryError()).toBeNull();
  });
});

describe("ESQL_SYNTAX_GUIDE", () => {
  it("contains key ES|QL commands", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("FROM");
    expect(ESQL_SYNTAX_GUIDE).toContain("WHERE");
    expect(ESQL_SYNTAX_GUIDE).toContain("STATS");
    expect(ESQL_SYNTAX_GUIDE).toContain("EVAL");
    expect(ESQL_SYNTAX_GUIDE).toContain("SORT");
    expect(ESQL_SYNTAX_GUIDE).toContain("LIMIT");
  });

  it("contains aggregation functions", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("COUNT()");
    expect(ESQL_SYNTAX_GUIDE).toContain("AVG()");
    expect(ESQL_SYNTAX_GUIDE).toContain("SUM()");
  });

  it("contains an example query", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("FROM logs-*");
  });
});
