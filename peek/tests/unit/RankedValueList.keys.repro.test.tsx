import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import RankedValueList from "../../src/components/RankedValueList";

function rowNode(label: string) {
  return screen.getByText(label).closest('[role="button"]');
}

describe("RankedValueList key stability", () => {
  it("keeps row DOM identity for unchanged rows when leading rows are filtered out", () => {
    const onSelect = vi.fn();
    const initialRows = [
      { value: "A", metric: 100 },
      { value: "B", metric: 90 },
      { value: "C", metric: 80 },
    ];

    const { rerender } = render(
      <RankedValueList rows={initialRows} metricLabel="logs" onSelect={onSelect} />,
    );

    const bNodeBefore = rowNode("B");
    expect(bNodeBefore).toBeTruthy();

    rerender(
      <RankedValueList rows={initialRows.slice(1)} metricLabel="logs" onSelect={onSelect} />,
    );

    const bNodeAfter = rowNode("B");
    expect(bNodeAfter).toBeTruthy();
    expect(bNodeAfter).toBe(bNodeBefore);
  });
});
