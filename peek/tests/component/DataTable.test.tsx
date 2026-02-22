import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    ["2025-06-15T11:00:00.000Z", "aaa", 5],
  ],
};

describe("DataTable", () => {
  let originalClipboard: Clipboard | undefined;

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
      originalClipboard = undefined;
    }
    vi.restoreAllMocks();
  });

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
    await waitFor(() => expect(screen.queryByText("Row Inspector")).not.toBeInTheDocument());
  });

  it("copies selected row JSON from the inspector", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("hello world"));
    await user.click(screen.getByRole("button", { name: /copy json/i }));

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(
        {
          "@timestamp": "2025-06-15T12:00:00.000Z",
          message: "hello world",
          count: 42,
        },
        null,
        2,
      ),
    );
  });

  it("hides null inspector fields by default and allows showing them", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("foo bar"));
    expect(screen.getByRole("button", { name: /show null fields \(1\)/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show null fields \(1\)/i }));
    expect(screen.getByRole("button", { name: /hide null fields/i })).toBeInTheDocument();
  });

  it("filters flyout fields using search input", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("hello world"));
    const searchInput = screen.getByLabelText("Search fields");

    await user.type(searchInput, "nonexistent");
    expect(screen.getByText("No matching fields")).toBeInTheDocument();
  });

  it("filters flyout fields by value text", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByText("hello world"));
    const searchInput = screen.getByLabelText("Search fields");
    await user.type(searchInput, "hello world");

    expect(screen.getByTestId("row-inspector-field-message")).toBeInTheDocument();
    expect(screen.queryByTestId("row-inspector-field-count")).not.toBeInTheDocument();
  });

  it("renders no data message when columns are empty", () => {
    render(<DataTable data={{ columns: [], values: [] }} />);

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("cycles header sort state on click", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /^count$/i }));
    let rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("aaa");

    await user.click(screen.getByRole("button", { name: /^count$/i }));
    rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("hello world");
  });

  it("moves columns via header menu actions", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /column actions for count/i }));
    await user.click(screen.getByRole("menuitem", { name: /move column left/i }));

    const headers = screen.getAllByRole("columnheader");
    expect(within(headers[1]!).getByText("count")).toBeInTheDocument();
  });

  it("calls onRemoveColumn from header menu", async () => {
    const user = userEvent.setup();
    const onRemoveColumn = vi.fn();
    render(<DataTable data={mockData} onRemoveColumn={onRemoveColumn} />);

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));
    await user.click(screen.getByRole("menuitem", { name: /remove column/i }));

    expect(onRemoveColumn).toHaveBeenCalledWith("message");
  });
});
