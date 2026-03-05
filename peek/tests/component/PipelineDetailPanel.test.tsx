import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PipelineDetailPanel from "../../src/components/ingest-pipelines/PipelineDetailPanel";
import type { PipelineEntry } from "../../src/hooks/useIngestPipelines";

function makePipeline(name: string, processorTypes: string[]): PipelineEntry {
  return {
    name,
    pipeline: {
      processors: processorTypes.map((type, i) => ({ [type]: { value: i } })),
    },
  };
}

/**
 * Wrapper that manages pipeline state internally so React state in
 * PipelineDetailPanel is preserved across prop changes (avoids the
 * rerender-remount issue caused by the QueryClientProvider test mock).
 */
function Harness({ initial, updated }: { initial: string[]; updated: string[] }) {
  const [types, setTypes] = useState(initial);
  return (
    <div>
      <button onClick={() => setTypes(updated)}>update-processors</button>
      <PipelineDetailPanel
        selectedPipeline={makePipeline("p", types)}
        connection={null}
        pipelinesExist
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
});
