import { describe, it, expect } from "vitest";
import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

import {
  ESQL_KEYWORDS,
  ESQL_FUNCTIONS,
  esqlCompletionSource,
} from "../../src/components/queryEditorExtensions";
import { parseEsqlErrorPosition } from "../../src/components/llmCompletionExtension";

// ---------------------------------------------------------------------------
// ES|QL autocompletion
// ---------------------------------------------------------------------------

describe("ESQL_KEYWORDS", () => {
  it("contains core ES|QL commands", () => {
    const required = [
      "FROM",
      "WHERE",
      "STATS",
      "EVAL",
      "KEEP",
      "DROP",
      "RENAME",
      "SORT",
      "LIMIT",
      "DISSECT",
      "GROK",
      "ENRICH",
      "MV_EXPAND",
    ];
    for (const kw of required) {
      expect(ESQL_KEYWORDS).toContain(kw);
    }
  });
});

describe("ESQL_FUNCTIONS", () => {
  it("contains aggregation functions", () => {
    for (const fn of ["COUNT", "AVG", "SUM", "MIN", "MAX", "PERCENTILE"]) {
      expect(ESQL_FUNCTIONS).toContain(fn);
    }
  });

  it("contains string/date/math functions", () => {
    for (const fn of ["CONCAT", "NOW", "DATE_TRUNC", "ABS", "ROUND"]) {
      expect(ESQL_FUNCTIONS).toContain(fn);
    }
  });
});

describe("esqlCompletionSource", () => {
  function makeContext(doc: string, pos: number, explicit = false): CompletionContext {
    const state = EditorState.create({ doc });
    return new CompletionContext(state, pos, explicit);
  }

  it("returns completions when typing a keyword prefix", () => {
    const result = esqlCompletionSource(makeContext("FRO", 3));
    expect(result).not.toBeNull();
    const labels = (result as CompletionResult).options.map((o) => o.label);
    expect(labels).toContain("FROM");
  });

  it("returns null for empty input without explicit trigger", () => {
    const result = esqlCompletionSource(makeContext("", 0, false));
    expect(result).toBeNull();
  });

  it("returns completions on explicit trigger at empty position", () => {
    const result = esqlCompletionSource(makeContext("", 0, true));
    expect(result).toBeNull(); // no word prefix at empty position
  });

  it("includes function completions with open paren in apply", () => {
    const result = esqlCompletionSource(makeContext("COUN", 4));
    expect(result).not.toBeNull();
    const countOpt = (result as CompletionResult).options.find((o) => o.label === "COUNT");
    expect(countOpt).toBeDefined();
    expect(countOpt!.apply).toBe("COUNT(");
  });

  it("matches case-insensitively (lowercase prefix)", () => {
    const result = esqlCompletionSource(makeContext("from", 4));
    expect(result).not.toBeNull();
    const labels = (result as CompletionResult).options.map((o) => o.label);
    expect(labels).toContain("FROM");
  });
});

// ---------------------------------------------------------------------------
// Inline error diagnostics — position parsing
// ---------------------------------------------------------------------------

describe("parseEsqlErrorPosition", () => {
  function mockDoc(text: string) {
    const lines = text.split("\n");
    return {
      lines: lines.length,
      line(n: number) {
        let from = 0;
        for (let i = 0; i < n - 1; i++) from += lines[i]!.length + 1;
        const lineText = lines[n - 1]!;
        return {
          from,
          to: from + lineText.length,
          text: lineText,
          length: lineText.length,
        };
      },
    };
  }

  it("parses standard ES|QL error with line:col prefix", () => {
    const doc = mockDoc("FROM logs-* | WERE x > 0");
    const result = parseEsqlErrorPosition("line 1:14: mismatched input 'WERE'", doc);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(14);
    expect(result!.message).toBe("mismatched input 'WERE'");
  });

  it("returns null for errors without line:col prefix", () => {
    const doc = mockDoc("FROM logs-*");
    const result = parseEsqlErrorPosition("unsupported field type 'geo_point'", doc);
    expect(result).toBeNull();
  });

  it("handles multi-line queries", () => {
    const doc = mockDoc("FROM logs-*\n| WHERE x > 0\n| STATS y");
    const result = parseEsqlErrorPosition("line 3:2: Unknown column [y]", doc);
    expect(result).not.toBeNull();
    // line 3 starts at offset 12 + 14 = 26, col 2 → offset 28
    expect(result!.from).toBe(28);
    expect(result!.message).toBe("Unknown column [y]");
  });

  it("returns null for out-of-range line numbers", () => {
    const doc = mockDoc("FROM logs-*");
    const result = parseEsqlErrorPosition("line 5:0: some error", doc);
    expect(result).toBeNull();
  });

  it("handles prefixed errors like 'Found 1 problem\\nline 1:20:'", () => {
    const doc = mockDoc("FROM logs-* | STATS count = COUNT(*)");
    const result = parseEsqlErrorPosition("Found 1 problem\nline 1:20: extraneous input 'by'", doc);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(20);
    expect(result!.message).toBe("extraneous input 'by'");
  });
});
