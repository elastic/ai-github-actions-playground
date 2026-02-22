import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueryPipelineSteps from "../../src/components/QueryPipelineSteps";

describe("QueryPipelineSteps", () => {
  it("does not render when the query has one stage", () => {
    render(
      <QueryPipelineSteps
        query="FROM logs-*"
        loading={false}
        activeStep={null}
        onRunStep={vi.fn()}
      />,
    );

    expect(screen.queryByText("Run to step:")).not.toBeInTheDocument();
  });

  it("renders one chip per pipeline stage for multi-stage queries", () => {
    render(
      <QueryPipelineSteps
        query="FROM logs-* | SORT @timestamp DESC | LIMIT 50"
        loading={false}
        activeStep={null}
        onRunStep={vi.fn()}
      />,
    );

    expect(screen.getByText("Run to step:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\. FROM logs-\*/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\. SORT @timestamp DESC/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3\. LIMIT 50/i })).toBeInTheDocument();
  });

  it("runs cumulative query for the selected step", async () => {
    const user = userEvent.setup();
    const onRunStep = vi.fn();

    render(
      <QueryPipelineSteps
        query={'FROM logs-* | SORT @timestamp DESC | WHERE status == "error"'}
        loading={false}
        activeStep={null}
        onRunStep={onRunStep}
      />,
    );

    await user.click(screen.getByRole("button", { name: /3\. WHERE status == "error"/i }));

    expect(onRunStep).toHaveBeenCalledWith(
      'FROM logs-*\n| SORT @timestamp DESC\n| WHERE status == "error"',
      2,
    );
  });

  it("disables chips and shows a spinner on the active step while loading", () => {
    render(
      <QueryPipelineSteps
        query="FROM logs-* | SORT @timestamp DESC | LIMIT 50"
        loading
        activeStep={1}
        onRunStep={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const chip of screen.getAllByRole("button")) {
      expect(chip).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows ES timing label on steps when timing is provided", () => {
    render(
      <QueryPipelineSteps
        query="FROM logs-* | SORT @timestamp DESC | LIMIT 50"
        loading={false}
        activeStep={null}
        stepDurationsMs={{ 1: 1234 }}
        onRunStep={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /2\. SORT @timestamp DESC.*ES 1\.2s/i }),
    ).toBeInTheDocument();
  });
});
