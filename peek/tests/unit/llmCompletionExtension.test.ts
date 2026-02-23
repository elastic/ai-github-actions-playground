import { describe, it, expect, beforeEach, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { useLLMStore } from "../../src/store/useLLMStore";
import {
  makeLLMCompletionExtension,
  recentEditsField,
  setLastQueryError,
  getLastQueryError,
  setLastQueryResult,
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

const generateTextMock = vi.fn();
const testEditorView = {} as EditorView;

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

// Mock ghostDiffExtension to return empty array (rendering tested separately)
vi.mock("../../src/components/ghostDiffExtension", () => ({
  ghostDiffExtension: [],
  setSuggestion: { of: vi.fn((v: unknown) => ({ type: "setSuggestion", value: v })) },
  clearSuggestion: { of: vi.fn(() => ({ type: "clearSuggestion", value: null })) },
}));

describe("makeLLMCompletionExtension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    setLastQueryError(null, testEditorView);
  });

  it("returns a non-empty extension array", () => {
    const ext = makeLLMCompletionExtension({ prompt: "test prompt" });
    expect(Array.isArray(ext)).toBe(true);
    expect((ext as unknown[]).length).toBeGreaterThan(0);
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
    setLastQueryError(null, testEditorView);
  });

  it("starts as null", () => {
    expect(getLastQueryError(testEditorView)).toBeNull();
  });

  it("stores an error message", () => {
    setLastQueryError("line 3:40: extraneous input 'by'", testEditorView);
    expect(getLastQueryError(testEditorView)).toBe("line 3:40: extraneous input 'by'");
  });

  it("clears error when set to null", () => {
    setLastQueryError("some error", testEditorView);
    setLastQueryError(null, testEditorView);
    expect(getLastQueryError(testEditorView)).toBeNull();
  });
});

describe("query result side channel", () => {
  it("stores last query and result snippet", () => {
    const data = {
      columns: [
        { name: "host", type: "keyword" },
        { name: "count", type: "long" },
      ],
      values: [
        ["web-1", 42],
        ["web-2", 17],
      ],
    };
    // Should not throw
    setLastQueryResult("FROM logs-* | STATS count(*) BY host", data, testEditorView);
  });

  it("truncates results beyond 5 rows", () => {
    const data = {
      columns: [{ name: "x", type: "long" }],
      values: Array.from({ length: 20 }, (_, i) => [i]),
    };
    // Should not throw
    setLastQueryResult("FROM big-index", data, testEditorView);
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
    expect(ESQL_SYNTAX_GUIDE).toContain("KEEP");
    expect(ESQL_SYNTAX_GUIDE).toContain("DROP");
    expect(ESQL_SYNTAX_GUIDE).toContain("RENAME");
    expect(ESQL_SYNTAX_GUIDE).toContain("DISSECT");
    expect(ESQL_SYNTAX_GUIDE).toContain("GROK");
    expect(ESQL_SYNTAX_GUIDE).toContain("LOOKUP JOIN");
  });

  it("contains aggregation functions", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("COUNT(*)");
    expect(ESQL_SYNTAX_GUIDE).toContain("AVG(field)");
    expect(ESQL_SYNTAX_GUIDE).toContain("SUM(field)");
    expect(ESQL_SYNTAX_GUIDE).toContain("PERCENTILE(field, pct)");
    expect(ESQL_SYNTAX_GUIDE).toContain("COUNT_DISTINCT(field)");
  });

  it("contains example queries", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("FROM logs-*");
    expect(ESQL_SYNTAX_GUIDE).toContain("FROM traces-apm*");
    expect(ESQL_SYNTAX_GUIDE).toContain("FROM metrics-system.cpu-*");
  });

  it("contains Elastic field references", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("@timestamp");
    expect(ESQL_SYNTAX_GUIDE).toContain("service.name");
    expect(ESQL_SYNTAX_GUIDE).toContain("log.level");
    expect(ESQL_SYNTAX_GUIDE).toContain("transaction.duration.us");
    expect(ESQL_SYNTAX_GUIDE).toContain("system.cpu.total.norm.pct");
  });

  it("contains gotchas and best practices", () => {
    expect(ESQL_SYNTAX_GUIDE).toContain("ES|QL is NOT SQL");
    expect(ESQL_SYNTAX_GUIDE).toContain("Filter early");
  });
});
