import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransformTable } from "../../src/components/transforms/TransformTable";
import type { TransformRow } from "../../src/services/es/transformTypes";

const makeRow = (overrides: Partial<TransformRow> & { id: string }): TransformRow => ({
  description: "demo",
  state: "started",
  healthStatus: "green",
  type: "continuous",
  sourceIndices: ["logs-*"],
  destIndex: "logs-dest",
  destPipeline: "",
  frequency: "1m",
  docsProcessed: 1,
  docsIndexed: 1,
  searchFailures: 0,
  indexFailures: 0,
  checkpoint: 1,
  avgCheckpointDurationMs: 10,
  nodeName: "node-1",
  searchTimeMs: 0,
  indexTimeMs: 0,
  processingTimeMs: 0,
  deleteTimeMs: 0,
  triggerCount: 0,
  pagesProcessed: 0,
  docsDeleted: 0,
  expAvgDocsIndexed: 0,
  expAvgDocsProcessed: 0,
  nextCheckpoint: null,
  nextCheckpointDocsProcessed: null,
  nextCheckpointDocsIndexed: null,
  lastCheckpointTimeMs: null,
  syncField: "",
  syncDelay: "",
  retentionMaxAge: "",
  maxPageSearchSize: null,
  docsPerSecond: null,
  definition: {} as TransformRow["definition"],
  stats: {} as TransformRow["stats"],
  ...overrides,
});

describe("TransformTable keyboard accessibility", () => {
  it("data rows are focusable and have an accessible label", () => {
    render(
      <TransformTable
        rows={[makeRow({ id: "tx-1" })]}
        sortField="id"
        sortDir="asc"
        selectedId={null}
        onSort={() => {}}
        onSelect={() => {}}
      />,
    );

    const row = screen.getByRole("row", { name: /Open transform details for tx-1/i });
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("activates onSelect when Enter is pressed on a focused row", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TransformTable
        rows={[makeRow({ id: "tx-1" })]}
        sortField="id"
        sortDir="asc"
        selectedId={null}
        onSort={() => {}}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByRole("row", { name: /Open transform details for tx-1/i });
    row.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("tx-1");
  });

  it("activates onSelect when Space is pressed on a focused row", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TransformTable
        rows={[makeRow({ id: "tx-1" })]}
        sortField="id"
        sortDir="asc"
        selectedId={null}
        onSort={() => {}}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByRole("row", { name: /Open transform details for tx-1/i });
    row.focus();
    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledWith("tx-1");
  });

  it("does not activate onSelect for other keys", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TransformTable
        rows={[makeRow({ id: "tx-1" })]}
        sortField="id"
        sortDir="asc"
        selectedId={null}
        onSort={() => {}}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByRole("row", { name: /Open transform details for tx-1/i });
    row.focus();
    await user.keyboard("{Tab}");

    expect(onSelect).not.toHaveBeenCalled();
  });
});
