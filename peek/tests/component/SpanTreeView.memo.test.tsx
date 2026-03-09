import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { Span } from "../../src/components/traces/traceUtils";
import type { SpanTreeGroupRow } from "../../src/components/traces/span-tree-plugin/SpanTreeGroupRow";

type SpanTreeGroupRowProps = React.ComponentProps<typeof SpanTreeGroupRow>;

const rowRenderCounts = new Map<string, number>();
const rowClickHandlers = new Map<string, (spanId: string) => void>();
let groupRowRenderCount = 0;
let groupRepresentativeSpanId: string | null = null;
let groupRowClickHandler: ((spanId: string) => void) | null = null;

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
  const representativeSpan = spans[1];
  const groupRows = representativeSpan
    ? [
        {
          type: "group" as const,
          groupKey: "svc:op",
          parentId: "__roots__",
          spans: [{ span: representativeSpan, children: [] as never[], depth: 0 }],
          depth: 0,
          expanded: false,
          stats: {
            count: 1,
            totalDurationUs: representativeSpan.durationUs,
            minDurationUs: representativeSpan.durationUs,
            maxDurationUs: representativeSpan.durationUs,
            errorCount: 0,
            serviceName: representativeSpan.serviceName,
            operationName: representativeSpan.name,
          },
        },
      ]
    : [];
  return [
    ...spans.map((span) => ({
      type: "span" as const,
      node: { span, children: [] as never[], depth: 0 },
      expanded: false,
      hasChildren: false,
    })),
    ...groupRows,
  ];
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
    onClick,
  }: {
    node: { span: { spanId: string } };
    selected: boolean;
    onClick: (spanId: string) => void;
  }) {
    rowRenderCounts.set(node.span.spanId, (rowRenderCounts.get(node.span.spanId) ?? 0) + 1);
    rowClickHandlers.set(node.span.spanId, onClick);
    return <div data-testid={`row-${node.span.spanId}`} />;
  }),
}));

vi.mock("../../src/components/traces/span-tree-plugin/SpanTreeGroupRow", () => ({
  SpanTreeGroupRow: React.memo((props: SpanTreeGroupRowProps) => {
    groupRowRenderCount += 1;
    groupRepresentativeSpanId = props.representativeSpanId;
    groupRowClickHandler = props.onClick;
    return <div data-testid="group-row" />;
  }),
}));

vi.mock("../../src/components/traces/span-tree-plugin/SpanTreeToolbar", () => ({
  default: () => null,
}));

import SpanTreeView from "../../src/components/traces/span-tree-plugin/SpanTreeView";

let nextStartTimeUs = 1;
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
    startTimeUs: nextStartTimeUs++,
    attributes: {},
  };
}

describe("SpanTreeView memo", () => {
  beforeEach(() => {
    rowRenderCounts.clear();
    rowClickHandlers.clear();
    groupRowRenderCount = 0;
    groupRepresentativeSpanId = null;
    groupRowClickHandler = null;
    flatRowCache.clear();
    nextStartTimeUs = 1;
  });

  it("does not re-render unaffected rows when only selectedSpanId changes", () => {
    const spans = [buildSpan("span-1"), buildSpan("span-2"), buildSpan("span-3")];
    const onSelectTrace = vi.fn();
    const onSelectSpan = vi.fn();

    const { rerender } = render(
      <SpanTreeView
        spans={spans}
        showToolbar={false}
        selectedSpanId={"span-1"}
        onSelectTrace={onSelectTrace}
        onSelectSpan={onSelectSpan}
      />,
    );

    expect(rowRenderCounts.get("span-1")).toBe(1);
    expect(rowRenderCounts.get("span-2")).toBe(1);
    expect(rowRenderCounts.get("span-3")).toBe(1);
    expect(groupRowRenderCount).toBe(1);
    expect(groupRepresentativeSpanId).toBe("span-2");

    rowClickHandlers.get("span-3")?.("span-3");
    expect(onSelectTrace).toHaveBeenLastCalledWith("trace-1", "span-3", spans[2]?.timestamp);
    expect(onSelectSpan).toHaveBeenLastCalledWith("span-3");

    groupRowClickHandler?.("span-2");
    expect(onSelectTrace).toHaveBeenLastCalledWith("trace-1", "span-2", spans[1]?.timestamp);
    expect(onSelectSpan).toHaveBeenLastCalledWith("span-2");

    rerender(
      <SpanTreeView
        spans={spans}
        showToolbar={false}
        selectedSpanId={"span-3"}
        onSelectTrace={onSelectTrace}
        onSelectSpan={onSelectSpan}
      />,
    );

    // span-1 changed: selected true → false → should rerender
    expect(rowRenderCounts.get("span-1")).toBe(2);
    // span-3 changed: selected false → true → should rerender
    expect(rowRenderCounts.get("span-3")).toBe(2);
    // span-2 is unaffected: selected stayed false, all other props stable.
    // Without stable onClick callbacks, React.memo cannot skip this row.
    expect(rowRenderCounts.get("span-2")).toBe(1);
    expect(groupRowRenderCount).toBe(1);
  });
});
