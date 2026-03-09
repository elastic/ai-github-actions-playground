import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Span } from "../../src/components/traces/traceUtils";

const rowRenderCounts = new Map<string, number>();

vi.mock("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, item: unknown) => React.ReactNode;
  }) => (
    <div>
      {data.map((item, index) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

// Cache flat-row objects so the mock hook returns stable references when
// the same spans array is passed across re-renders — matching the real
// useSpanTree's useMemo behaviour.
const flatRowCache = new Map<Span[], ReturnType<typeof buildFlatRows>>();
function buildFlatRows(spans: Span[]) {
  return spans.map((span) => ({
    type: "span" as const,
    node: { span, children: [] as never[], depth: 0 },
    expanded: false,
    hasChildren: false,
  }));
}
const stableToggleExpand = vi.fn();
const stableToggleGroup = vi.fn();
const stableExpandAll = vi.fn();
const stableCollapseAll = vi.fn();

vi.mock("../../src/components/traces/span-tree-plugin/useSpanTree", () => ({
  useSpanTree: (spans: Span[]) => {
    let rows = flatRowCache.get(spans);
    if (!rows) {
      rows = buildFlatRows(spans);
      flatRowCache.set(spans, rows);
    }
    return {
      flatRows: rows,
      searchMode: false,
      toggleExpand: stableToggleExpand,
      toggleGroup: stableToggleGroup,
      expandAll: stableExpandAll,
      collapseAll: stableCollapseAll,
    };
  },
}));

vi.mock("../../src/components/traces/span-tree-plugin/SpanTreeRow", () => ({
  SpanTreeRow: React.memo(function MockSpanTreeRow({
    node,
  }: {
    node: { span: { spanId: string } };
    selected: boolean;
    onClick: (spanId: string) => void;
  }) {
    rowRenderCounts.set(node.span.spanId, (rowRenderCounts.get(node.span.spanId) ?? 0) + 1);
    return <div data-testid={`row-${node.span.spanId}`} />;
  }),
}));

vi.mock("../../src/components/traces/span-tree-plugin/SpanTreeGroupRow", () => ({
  SpanTreeGroupRow: React.memo(() => <div data-testid="group-row" />),
}));

vi.mock("../../src/components/traces/span-tree-plugin/SpanTreeToolbar", () => ({
  default: () => null,
}));

import SpanTreeView from "../../src/components/traces/span-tree-plugin/SpanTreeView";

function buildSpan(spanId: string): Span {
  return {
    traceId: "trace-1",
    spanId,
    parentSpanId: null,
    serviceName: "svc",
    name: `op-${spanId}`,
    kind: "INTERNAL",
    durationUs: 100,
    status: "OK",
    timestamp: "2026-01-01T00:00:00.000Z",
    startTimeUs: spanId === "span-1" ? 1 : 2,
    attributes: {},
  };
}

describe("SpanTreeView memo", () => {
  beforeEach(() => {
    rowRenderCounts.clear();
    flatRowCache.clear();
  });

  it("does not re-render unaffected rows when only selectedSpanId changes", () => {
    const spans = [buildSpan("span-1"), buildSpan("span-2"), buildSpan("span-3")];

    const { rerender } = render(
      <SpanTreeView spans={spans} showToolbar={false} selectedSpanId={"span-1"} />,
    );

    expect(rowRenderCounts.get("span-1")).toBe(1);
    expect(rowRenderCounts.get("span-2")).toBe(1);
    expect(rowRenderCounts.get("span-3")).toBe(1);

    rerender(<SpanTreeView spans={spans} showToolbar={false} selectedSpanId={"span-3"} />);

    // span-1 changed: selected true → false → should rerender
    expect(rowRenderCounts.get("span-1")).toBe(2);
    // span-3 changed: selected false → true → should rerender
    expect(rowRenderCounts.get("span-3")).toBe(2);
    // span-2 is unaffected: selected stayed false, all other props stable.
    // Without stable onClick callbacks, React.memo cannot skip this row.
    expect(rowRenderCounts.get("span-2")).toBe(1);
  });
});
