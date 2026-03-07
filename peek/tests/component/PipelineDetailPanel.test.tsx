import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PipelineDetailPanel from "../../src/components/ingest-pipelines/PipelineDetailPanel";
import type { PipelineEntry } from "../../src/hooks/useIngestPipelines";

type ProcessorInput = string | Record<string, Record<string, unknown>>;

function makePipeline(name: string, processorsInput: ProcessorInput[]): PipelineEntry {
  return {
    name,
    pipeline: {
      processors: processorsInput.map((processor) =>
        typeof processor === "string" ? { [processor]: { value: processor } } : processor,
      ),
    },
  };
}

/**
 * Wrapper that manages pipeline state internally so React state in
 * PipelineDetailPanel is preserved across prop changes (avoids the
 * rerender-remount issue caused by the QueryClientProvider test mock).
 */
function Harness({ initial, updated }: { initial: ProcessorInput[]; updated: ProcessorInput[] }) {
  const [types, setTypes] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setTypes(updated)}>
        update-processors
      </button>
      <PipelineDetailPanel
        selectedPipeline={makePipeline("p", types)}
        connection={null}
        pipelinesExist
        ingestNodeStatsResult={{ status: "idle" }}
      />
    </div>
  );
}

describe("PipelineDetailPanel processor expansion state", () => {
  it("keeps expanded processor by identity after processor insertion", async () => {
    const user = userEvent.setup();

    render(<Harness initial={["a", "b"]} updated={["x", "a", "b"]} />);

    const bGroupInitial = screen.getByRole("group", { name: "b" });
    await user.click(within(bGroupInitial).getByRole("button", { name: "Show config" }));
    expect(within(bGroupInitial).getByRole("button", { name: "Hide config" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "update-processors" }));

    const bGroupAfter = screen.getByRole("group", { name: "b" });
    expect(within(bGroupAfter).getByRole("button", { name: "Hide config" })).toBeInTheDocument();
  });

  it("keeps expanded processor by identity after processor removal", async () => {
    const user = userEvent.setup();

    render(<Harness initial={["a", "b", "c"]} updated={["b", "c"]} />);

    const cGroup = screen.getByRole("group", { name: "c" });
    await user.click(within(cGroup).getByRole("button", { name: "Show config" }));
    expect(within(cGroup).getByRole("button", { name: "Hide config" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "update-processors" }));

    const cGroupAfter = screen.getByRole("group", { name: "c" });
    expect(within(cGroupAfter).getByRole("button", { name: "Hide config" })).toBeInTheDocument();
  });

  it("keeps expanded processor when same-type processor is inserted earlier", async () => {
    const user = userEvent.setup();

    render(
      <Harness
        initial={[{ a: { id: "first" } }, { a: { id: "second" } }, { b: { id: "third" } }]}
        updated={[
          { a: { id: "new" } },
          { a: { id: "first" } },
          { a: { id: "second" } },
          { b: { id: "third" } },
        ]}
      />,
    );

    const aGroupsInitial = screen.getAllByRole("group", { name: "a" });
    await user.click(within(aGroupsInitial[1]!).getByRole("button", { name: "Show config" }));
    expect(
      within(aGroupsInitial[1]!).getByRole("button", { name: "Hide config" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "update-processors" }));

    const aGroupsAfter = screen.getAllByRole("group", { name: "a" });
    expect(
      within(aGroupsAfter[2]!).getByRole("button", { name: "Hide config" }),
    ).toBeInTheDocument();
  });
});
