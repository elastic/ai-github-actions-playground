import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ChartOptionsEditor from "../../src/components/ChartOptionsEditor";
import type { VisualizationOptions, FormatOptions } from "../../src/types";

vi.mock("../../src/components/perses/panelRegistry", () => ({
  getPersesPanelEntry: (type: string) => {
    if (type === "stat") {
      return {
        OptionsEditor: ({
          options,
          onChange,
        }: {
          options: VisualizationOptions;
          onChange: (o: VisualizationOptions) => void;
        }) => (
          <button
            type="button"
            onClick={() => onChange({ ...options, sparkline: true })}
            data-testid="stat-options-editor"
          >
            Toggle sparkline
          </button>
        ),
      };
    }
    if (type === "table") {
      return {
        OptionsEditor: () => <div data-testid="table-options-editor">Table opts</div>,
      };
    }
    return undefined;
  },
}));

vi.mock("@perses-dev/components", () => ({
  FormatControls: ({
    value,
    onChange,
  }: {
    value: FormatOptions;
    onChange: (f: FormatOptions) => void;
  }) => (
    <button
      type="button"
      data-testid="format-controls"
      onClick={() => onChange({ ...value, unit: "percent-decimal" })}
    >
      Set percent
    </button>
  ),
}));

describe("ChartOptionsEditor", () => {
  it("renders format controls for non-table visualization types", () => {
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="timeseries" options={{}} onChange={onChange} />);

    expect(screen.getByTestId("format-controls")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
  });

  it("does not render format controls for table visualization type", () => {
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="table" options={{}} onChange={onChange} />);

    expect(screen.queryByTestId("format-controls")).not.toBeInTheDocument();
    expect(screen.getByTestId("table-options-editor")).toBeInTheDocument();
  });

  it("emits onChange with updated format when format controls are changed", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="timeseries" options={{}} onChange={onChange} />);

    await user.click(screen.getByTestId("format-controls"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ format: { unit: "percent-decimal" } }),
    );
  });

  it("renders the OptionsEditor from the panel registry when available", () => {
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="stat" options={{}} onChange={onChange} />);

    expect(screen.getByTestId("stat-options-editor")).toBeInTheDocument();
  });

  it("emits onChange from the viz-specific OptionsEditor", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="stat" options={{}} onChange={onChange} />);

    await user.click(screen.getByTestId("stat-options-editor"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sparkline: true }));
  });

  it("does not render an OptionsEditor when the registry has no entry", () => {
    const onChange = vi.fn();
    render(<ChartOptionsEditor vizType="timeseries" options={{}} onChange={onChange} />);

    expect(screen.queryByTestId("stat-options-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("table-options-editor")).not.toBeInTheDocument();
  });
});
