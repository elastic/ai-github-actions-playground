import { describe, it, expect } from "vitest";

import {
  interpolateParameters,
  extractEsqlBlocks,
  formatEsqlResult,
  replaceEsqlBlocks,
} from "../../src/services/markdownInterpolation";
import type { DashboardParameter, EsqlResponse } from "../../src/types";

const makeParam = (
  name: string,
  value: string | number | boolean,
  type: DashboardParameter["type"] = "keyword",
): DashboardParameter => ({
  name,
  label: name,
  type,
  source: { mode: "text" },
  value,
});

describe("interpolateParameters", () => {
  it("replaces a single token", () => {
    const result = interpolateParameters("Owner: {{service}}", [makeParam("service", "web")]);
    expect(result).toBe("Owner: web");
  });

  it("replaces multiple distinct tokens", () => {
    const result = interpolateParameters("{{service}} in {{environment}}", [
      makeParam("service", "api"),
      makeParam("environment", "prod"),
    ]);
    expect(result).toBe("api in prod");
  });

  it("replaces repeated tokens", () => {
    const result = interpolateParameters("{{service}} / {{service}}", [
      makeParam("service", "web"),
    ]);
    expect(result).toBe("web / web");
  });

  it("leaves unknown tokens unchanged", () => {
    const result = interpolateParameters("{{unknown}} stays", [makeParam("service", "web")]);
    expect(result).toBe("{{unknown}} stays");
  });

  it("handles numeric parameter values", () => {
    const result = interpolateParameters("SLO: {{target}}%", [makeParam("target", 99.9, "number")]);
    expect(result).toBe("SLO: 99.9%");
  });

  it("handles boolean parameter values", () => {
    const result = interpolateParameters("Debug: {{debug}}", [makeParam("debug", true, "boolean")]);
    expect(result).toBe("Debug: true");
  });

  it("returns content unchanged when parameters is undefined", () => {
    expect(interpolateParameters("{{service}}", undefined)).toBe("{{service}}");
  });

  it("returns content unchanged when parameters array is empty", () => {
    expect(interpolateParameters("{{service}}", [])).toBe("{{service}}");
  });

  it("returns content unchanged when there are no tokens", () => {
    const result = interpolateParameters("Plain text", [makeParam("service", "web")]);
    expect(result).toBe("Plain text");
  });

  it("does not match tokens with spaces inside braces", () => {
    const result = interpolateParameters("{{ service }}", [makeParam("service", "web")]);
    expect(result).toBe("{{ service }}");
  });
});

// ---------------------------------------------------------------------------
// extractEsqlBlocks
// ---------------------------------------------------------------------------

describe("extractEsqlBlocks", () => {
  it("extracts a single ES|QL block", () => {
    const blocks = extractEsqlBlocks("Top: ${FROM sales-* | LIMIT 1}");
    expect(blocks).toEqual([{ raw: "${FROM sales-* | LIMIT 1}", query: "FROM sales-* | LIMIT 1" }]);
  });

  it("extracts multiple ES|QL blocks", () => {
    const blocks = extractEsqlBlocks("A: ${FROM a | LIMIT 1} B: ${FROM b | LIMIT 2}");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.query).toBe("FROM a | LIMIT 1");
    expect(blocks[1]?.query).toBe("FROM b | LIMIT 2");
  });

  it("returns empty array when there are no blocks", () => {
    expect(extractEsqlBlocks("No queries here")).toEqual([]);
  });

  it("trims whitespace inside the block", () => {
    const blocks = extractEsqlBlocks("${  FROM x | LIMIT 1  }");
    expect(blocks[0]?.query).toBe("FROM x | LIMIT 1");
  });

  it("keeps full block when ES|QL query contains } inside double-quoted string", () => {
    const content = 'Pattern: ${FROM logs-* | EVAL ok = GROK(message, "%{WORD:word}") | LIMIT 1}';
    const blocks = extractEsqlBlocks(content);
    expect(blocks).toEqual([
      {
        raw: '${FROM logs-* | EVAL ok = GROK(message, "%{WORD:word}") | LIMIT 1}',
        query: 'FROM logs-* | EVAL ok = GROK(message, "%{WORD:word}") | LIMIT 1',
      },
    ]);
  });

  it("keeps full block when ES|QL query contains } inside single-quoted string", () => {
    const content = "Pattern: ${FROM logs-* | EVAL ok = GROK(message, '%{WORD:word}') | LIMIT 1}";
    const blocks = extractEsqlBlocks(content);
    expect(blocks).toEqual([
      {
        raw: "${FROM logs-* | EVAL ok = GROK(message, '%{WORD:word}') | LIMIT 1}",
        query: "FROM logs-* | EVAL ok = GROK(message, '%{WORD:word}') | LIMIT 1",
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// formatEsqlResult
// ---------------------------------------------------------------------------

const col = (name: string) => ({ name, type: "keyword" });

describe("formatEsqlResult", () => {
  it("renders _No results_ for empty data", () => {
    const data: EsqlResponse = { columns: [col("name")], values: [] };
    expect(formatEsqlResult(data)).toBe("_No results_");
  });

  it("renders inline value for 1 row × 1 column", () => {
    const data: EsqlResponse = { columns: [col("name")], values: [["Acme"]] };
    expect(formatEsqlResult(data)).toBe("Acme");
  });

  it("renders bulleted list for N rows × 1 column", () => {
    const data: EsqlResponse = {
      columns: [col("name")],
      values: [["Alice"], ["Bob"], ["Carol"]],
    };
    expect(formatEsqlResult(data)).toBe("- Alice\n- Bob\n- Carol");
  });

  it("renders markdown table for N rows × M columns", () => {
    const data: EsqlResponse = {
      columns: [col("name"), col("dob")],
      values: [
        ["Alice", "1990-01-01"],
        ["Bob", "1985-06-15"],
      ],
    };
    const result = formatEsqlResult(data);
    const lines = result.split("\n");
    expect(lines[0]).toBe("name | dob");
    expect(lines[1]).toBe("--- | ---");
    expect(lines[2]).toBe("Alice | 1990-01-01");
    expect(lines[3]).toBe("Bob | 1985-06-15");
  });

  it("handles null values", () => {
    const data: EsqlResponse = { columns: [col("name")], values: [[null]] };
    expect(formatEsqlResult(data)).toBe("");
  });

  it("escapes pipe characters in table cell values", () => {
    const data: EsqlResponse = {
      columns: [col("service"), col("status")],
      values: [["api|gateway", "ok"]],
    };
    const result = formatEsqlResult(data);
    const lines = result.split("\n");
    expect(lines[2]).toBe("api\\|gateway | ok");
  });

  it("escapes backslash characters in table cell values", () => {
    const data: EsqlResponse = {
      columns: [col("path"), col("count")],
      values: [["C:\\Users\\foo", "1"]],
    };
    const result = formatEsqlResult(data);
    const lines = result.split("\n");
    expect(lines[2]).toBe("C:\\\\Users\\\\foo | 1");
  });
});

// ---------------------------------------------------------------------------
// replaceEsqlBlocks
// ---------------------------------------------------------------------------

describe("replaceEsqlBlocks", () => {
  it("replaces resolved blocks with formatted results", () => {
    const content = "Top customer: ${FROM sales | LIMIT 1}";
    const results = new Map<string, EsqlResponse>([
      ["${FROM sales | LIMIT 1}", { columns: [col("name")], values: [["Acme"]] }],
    ]);
    expect(replaceEsqlBlocks(content, results)).toBe("Top customer: Acme");
  });

  it("leaves unresolved blocks as-is", () => {
    const content = "Value: ${FROM missing | LIMIT 1}";
    expect(replaceEsqlBlocks(content, new Map())).toBe(content);
  });

  it("replaces multiple blocks independently", () => {
    const content = "${FROM a | LIMIT 1} and ${FROM b | LIMIT 1}";
    const results = new Map<string, EsqlResponse>([
      ["${FROM a | LIMIT 1}", { columns: [col("v")], values: [["X"]] }],
      ["${FROM b | LIMIT 1}", { columns: [col("v")], values: [["Y"]] }],
    ]);
    expect(replaceEsqlBlocks(content, results)).toBe("X and Y");
  });
});
