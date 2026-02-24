import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataTable from "../../src/components/visualizations/DataTable";
import type { EsqlResponse, TablePanelOptions } from "../../src/types";

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

  it("calls onSortChange on first header click with asc direction", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<DataTable data={mockData} onSortChange={onSortChange} />);

    await user.click(screen.getByRole("button", { name: /^count$/i }));

    expect(onSortChange).toHaveBeenCalledWith("count", "asc");
  });

  it("calls onSortChange with desc when already sorted asc", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        data={mockData}
        currentSort={{ columnName: "count", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^count$/i }));

    expect(onSortChange).toHaveBeenCalledWith("count", "desc");
  });

  it("calls onSortChange with null when already sorted desc", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        data={mockData}
        currentSort={{ columnName: "count", direction: "desc" }}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^count$/i }));

    expect(onSortChange).toHaveBeenCalledWith("count", null);
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

  it("shows Pin left menu item for unpinned columns", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));

    expect(screen.getByRole("menuitem", { name: /pin left/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^unpin$/i })).not.toBeInTheDocument();
  });

  it("pins a column and moves it to the first position", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /column actions for count/i }));
    await user.click(screen.getByRole("menuitem", { name: /pin left/i }));

    const headers = screen.getAllByRole("columnheader");
    expect(within(headers[0]!).getByText("count")).toBeInTheDocument();
  });

  it("shows Unpin menu item for a pinned column and hides Pin left", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));
    await user.click(screen.getByRole("menuitem", { name: /pin left/i }));

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));

    expect(screen.getByRole("menuitem", { name: /^unpin$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /pin left/i })).not.toBeInTheDocument();
  });

  it("unpins a pinned column and removes sticky positioning", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));
    await user.click(screen.getByRole("menuitem", { name: /pin left/i }));

    const headers = screen.getAllByRole("columnheader");
    const pinnedHeader = headers[0]!;
    expect(within(pinnedHeader).getByText("message")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "hello world" })).toHaveStyle({ position: "sticky" });

    await user.click(screen.getByRole("button", { name: /column actions for message/i }));
    await user.click(screen.getByRole("menuitem", { name: /^unpin$/i }));

    expect(screen.getByRole("cell", { name: "hello world" })).not.toHaveStyle({
      position: "sticky",
    });
  });

  describe("selectedColumns option (Discover-to-Dashboard fidelity)", () => {
    it("hides columns not in selectedColumns and shows a banner", () => {
      const options: TablePanelOptions = { selectedColumns: ["message", "count"] };
      render(<DataTable data={mockData} options={options} />);

      // Hidden column should not appear as a header
      expect(screen.queryByRole("columnheader", { name: /@timestamp/i })).not.toBeInTheDocument();
      // Selected columns should be visible
      expect(screen.getByRole("columnheader", { name: /message/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /count/i })).toBeInTheDocument();
      // Banner should note the hidden column count
      expect(screen.getByText(/1 column hidden by view/i)).toBeInTheDocument();
    });

    it("shows hidden columns when the Show link is clicked", async () => {
      const user = userEvent.setup();
      const options: TablePanelOptions = { selectedColumns: ["message"] };
      render(<DataTable data={mockData} options={options} />);

      expect(screen.queryByRole("columnheader", { name: /@timestamp/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /show/i }));

      expect(screen.getByRole("columnheader", { name: /@timestamp/i })).toBeInTheDocument();
    });

    it("preserves the order defined by selectedColumns", () => {
      const options: TablePanelOptions = { selectedColumns: ["count", "message"] };
      render(<DataTable data={mockData} options={options} />);

      const headers = screen.getAllByRole("columnheader");
      const names = headers.map((h) => h.textContent?.replace(/\s+/g, " ").trim());
      const countIdx = names.findIndex((n) => n?.includes("count"));
      const messageIdx = names.findIndex((n) => n?.includes("message"));
      expect(countIdx).toBeLessThan(messageIdx);
    });

    it("shows all columns when selectedColumns is empty", () => {
      const options: TablePanelOptions = { selectedColumns: [] };
      render(<DataTable data={mockData} options={options} />);

      expect(screen.getByRole("columnheader", { name: /@timestamp/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /message/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /count/i })).toBeInTheDocument();
      expect(screen.queryByText(/hidden by view/i)).not.toBeInTheDocument();
    });
  });

  describe("sortState option (Discover-to-Dashboard fidelity)", () => {
    it("displays the sort indicator from options.sortState when no currentSort prop is provided", () => {
      const options: TablePanelOptions = { sortState: { columnName: "count", direction: "desc" } };
      render(<DataTable data={mockData} options={options} />);

      // The column header for 'count' should have aria-sort="descending"
      const countHeader = screen.getByRole("columnheader", { name: /count/i });
      expect(countHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("currentSort prop takes precedence over options.sortState", () => {
      const options: TablePanelOptions = { sortState: { columnName: "count", direction: "desc" } };
      render(
        <DataTable
          data={mockData}
          options={options}
          currentSort={{ columnName: "message", direction: "asc" }}
        />,
      );

      const messageHeader = screen.getByRole("columnheader", { name: /message/i });
      expect(messageHeader).toHaveAttribute("aria-sort", "ascending");

      // count should NOT have active sort
      const countHeader = screen.getByRole("columnheader", { name: /count/i });
      expect(countHeader).not.toHaveAttribute("aria-sort");
    });
  });
});
