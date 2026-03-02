import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithA11y } from "../helpers/renderWithA11y";
import RowInspectorFlyout from "../../src/components/visualizations/RowInspectorFlyout";

const SAMPLE_COLUMNS = [
  { name: "service.name", type: "keyword" },
  { name: "duration", type: "long" },
];
const SAMPLE_ROW = ["frontend", 42];

describe("RowInspectorFlyout", () => {
  beforeEach(() => {
    // Reset clipboard to a working mock by default
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("has no accessibility violations", async () => {
    await renderWithA11y(
      <RowInspectorFlyout
        open={true}
        onClose={() => {}}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );
  });

  it("renders the Row Inspector header", () => {
    render(
      <RowInspectorFlyout
        open={true}
        onClose={() => {}}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
  });

  it("renders column names and values", () => {
    render(
      <RowInspectorFlyout
        open={true}
        onClose={() => {}}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );
    expect(screen.getByText("service.name")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("copies JSON when Clipboard API is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <RowInspectorFlyout
        open={true}
        onClose={() => {}}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );

    await userEvent.click(screen.getByLabelText("Copy JSON"));
    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify({ "service.name": "frontend", duration: 42 }, null, 2),
    );
  });

  it("does not throw when Clipboard API is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    try {
      render(
        <RowInspectorFlyout
          open={true}
          onClose={() => {}}
          columns={SAMPLE_COLUMNS}
          row={SAMPLE_ROW}
        />,
      );

      await userEvent.click(screen.getByLabelText("Copy JSON"));
      expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    } finally {
      if (original !== undefined) {
        Object.defineProperty(navigator, "clipboard", original);
      }
    }
  });

  it("shows error message when clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    render(
      <RowInspectorFlyout
        open={true}
        onClose={() => {}}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );

    await userEvent.click(screen.getByLabelText("Copy JSON"));
    expect(await screen.findByText("Failed to copy JSON.")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <RowInspectorFlyout
        open={true}
        onClose={onClose}
        columns={SAMPLE_COLUMNS}
        row={SAMPLE_ROW}
      />,
    );

    await userEvent.click(screen.getByLabelText("Close inspector"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
