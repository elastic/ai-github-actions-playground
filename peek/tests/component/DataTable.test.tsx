import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable from "../../src/components/visualizations/DataTable";
import type { EsqlResponse } from "../../src/types";

const mockData: EsqlResponse = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "message", type: "keyword" },
    { name: "count", type: "long" },
  ],
  values: [
    ["2025-06-15T12:00:00.000Z", "hello world", 42],
    ["2025-06-15T13:00:00.000Z", "foo bar", null],
  ],
};

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable data={mockData} />);

    expect(screen.getByText("@timestamp")).toBeInTheDocument();
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByText("count")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<DataTable data={mockData} />);

    expect(screen.getByText("2025-06-15T12:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders null cells with a null label", () => {
    render(<DataTable data={mockData} />);

    expect(screen.getAllByText("null").length).toBeGreaterThan(0);
  });

  it("opens the row inspector flyout when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    // Flyout should not be visible initially
    expect(screen.queryByText("Row Inspector")).not.toBeInTheDocument();

    // Click the first data row (find by one of its cells)
    await user.click(screen.getByText("hello world"));

    // Flyout should now be open showing the row fields
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    expect(screen.getAllByText("@timestamp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("message").length).toBeGreaterThanOrEqual(1);
  });

  it("closes the row inspector flyout when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("hello world"));
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close inspector/i }));
    await waitFor(() =>
      expect(screen.queryByText("Row Inspector")).not.toBeInTheDocument(),
    );
  });

  it("shows a copy JSON button in the row inspector", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("hello world"));
    expect(screen.getByRole("button", { name: /copy json/i })).toBeInTheDocument();
  });

  it("renders no data message when columns are empty", () => {
    render(<DataTable data={{ columns: [], values: [] }} />);

    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
