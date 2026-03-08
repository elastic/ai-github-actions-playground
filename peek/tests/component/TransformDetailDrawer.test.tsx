// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TransformDetailDrawer } from "../../src/components/transforms/TransformDetailDrawer";
import type { TransformRow } from "../../src/services/es";

function makeRow(id: string): TransformRow {
  return {
    id,
    description: "desc",
    state: "started",
    healthStatus: "green",
    type: "continuous",
    sourceIndices: ["src"],
    destIndex: "dest",
    destPipeline: "",
    frequency: "1m",
    docsProcessed: 1,
    docsIndexed: 1,
    searchFailures: 0,
    indexFailures: 0,
    checkpoint: 1,
    avgCheckpointDurationMs: 1,
    nodeName: "node",
    searchTimeMs: 1,
    indexTimeMs: 1,
    processingTimeMs: 1,
    deleteTimeMs: 0,
    triggerCount: 1,
    pagesProcessed: 1,
    docsDeleted: 0,
    expAvgDocsIndexed: 1,
    expAvgDocsProcessed: 1,
    nextCheckpoint: null,
    nextCheckpointDocsProcessed: null,
    nextCheckpointDocsIndexed: null,
    lastCheckpointTimeMs: null,
    syncField: "",
    syncDelay: "",
    retentionMaxAge: "",
    maxPageSearchSize: null,
    docsPerSecond: null,
    definition: {
      id,
      source: { index: ["src"] },
      dest: { index: "dest" },
    },
    stats: {
      id,
      state: "started",
    },
  };
}

describe("TransformDetailDrawer raw JSON toggle", () => {
  it("should reset raw JSON to collapsed when drawer is closed and reopened", () => {
    const row = makeRow("tx-1");
    const { rerender } = render(<TransformDetailDrawer row={row} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Show raw JSON" }));
    expect(screen.getByRole("button", { name: "Hide raw JSON" })).toBeInTheDocument();

    rerender(<TransformDetailDrawer row={null} onClose={() => {}} />);
    rerender(<TransformDetailDrawer row={row} onClose={() => {}} />);

    // Expected UX: each open starts collapsed.
    expect(screen.getByRole("button", { name: "Show raw JSON" })).toBeInTheDocument();
  });

  it("keeps raw JSON expanded when the same transform id is refreshed", () => {
    const row = makeRow("tx-1");
    const refreshedRow = {
      ...makeRow("tx-1"),
      docsProcessed: 2,
      stats: { id: "tx-1", state: "started" },
    };
    const { rerender } = render(<TransformDetailDrawer row={row} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Show raw JSON" }));
    expect(screen.getByRole("button", { name: "Hide raw JSON" })).toBeInTheDocument();

    rerender(<TransformDetailDrawer row={refreshedRow} onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Hide raw JSON" })).toBeInTheDocument();
  });
});
