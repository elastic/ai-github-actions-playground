import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders pagination showing total row count", () => {
    const data: EsqlResponse = {
      columns: [{ name: "val", type: "long" }],
      values: Array.from({ length: 60 }, (_, i) => [i]),
    };
    render(<DataTable data={data} />);

    expect(screen.getByText("1–25 of 60")).toBeInTheDocument();
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    const data: EsqlResponse = {
      columns: [{ name: "val", type: "long" }],
      values: Array.from({ length: 60 }, (_, i) => [i]),
    };
    render(<DataTable data={data} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(screen.getByText("26–50 of 60")).toBeInTheDocument();
  });

  it("renders the Export CSV button when onExportCsv is provided", () => {
    const onExportCsv = vi.fn();
    render(<DataTable data={mockData} onExportCsv={onExportCsv} />);

    expect(
      screen.getByRole("button", { name: /export all results with selected columns as csv/i }),
    ).toBeInTheDocument();
  });

  it("does not render the Export CSV button when onExportCsv is not provided", () => {
    render(<DataTable data={mockData} />);

    expect(
      screen.queryByRole("button", { name: /export all results with selected columns as csv/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onExportCsv when the Export CSV button is clicked", async () => {
    const user = userEvent.setup();
    const onExportCsv = vi.fn();
    render(<DataTable data={mockData} onExportCsv={onExportCsv} />);

    await user.click(
      screen.getByRole("button", { name: /export all results with selected columns as csv/i }),
    );

    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });

  it("hides empty columns by default and shows a toggle link", () => {
    const dataWithEmpty: EsqlResponse = {
      columns: [
        { name: "filled", type: "keyword" },
        { name: "empty_col", type: "keyword" },
      ],
      values: [["val", null]],
    };
    render(<DataTable data={dataWithEmpty} />);

    expect(screen.getByText(/1 empty column hidden/i)).toBeInTheDocument();
    expect(screen.getByText("filled")).toBeInTheDocument();
  });

  it("shows empty columns when the Show link is clicked", async () => {
    const user = userEvent.setup();
    const dataWithEmpty: EsqlResponse = {
      columns: [
        { name: "filled", type: "keyword" },
        { name: "empty_col", type: "keyword" },
      ],
      values: [["val", null]],
    };
    render(<DataTable data={dataWithEmpty} />);

    await user.click(screen.getByText("Show"));

    expect(screen.getByText("empty_col")).toBeInTheDocument();
  });

  it("does not show expand button for short cell values", () => {
    render(<DataTable data={mockData} />);

    expect(screen.queryByRole("button", { name: /expand cell value/i })).not.toBeInTheDocument();
  });

  it("truncates long cell values and shows a 'more' expand button", () => {
    const longValue = "a".repeat(300);
    const longData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: [[longValue]],
    };
    render(<DataTable data={longData} />);

    expect(screen.getByRole("button", { name: /expand cell value/i })).toBeInTheDocument();
    expect(screen.queryByText(longValue)).not.toBeInTheDocument();
  });

  it("expands a truncated cell value when the 'more' button is clicked", async () => {
    const user = userEvent.setup();
    const longValue = "a".repeat(300);
    const longData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: [[longValue]],
    };
    render(<DataTable data={longData} />);

    await user.click(screen.getByRole("button", { name: /expand cell value/i }));

    expect(screen.getByText(longValue)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse cell value/i })).toBeInTheDocument();
  });

  it("collapses an expanded cell value when the 'less' button is clicked", async () => {
    const user = userEvent.setup();
    const longValue = "b".repeat(300);
    const longData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: [[longValue]],
    };
    render(<DataTable data={longData} />);

    await user.click(screen.getByRole("button", { name: /expand cell value/i }));
    expect(screen.getByText(longValue)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /collapse cell value/i }));
    expect(screen.queryByText(longValue)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand cell value/i })).toBeInTheDocument();
  });

  it("does not open row inspector when toggling truncated cell with keyboard", async () => {
    const longValue = "c".repeat(300);
    const longData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: [[longValue]],
    };
    render(<DataTable data={longData} />);

    const expandButton = screen.getByRole("button", { name: /expand cell value/i });
    fireEvent.keyDown(expandButton, { key: "Enter" });

    expect(screen.getByRole("button", { name: /expand cell value/i })).toBeInTheDocument();
    expect(screen.queryByText("Row Inspector")).not.toBeInTheDocument();
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

  it("navigates to the next row with ArrowDown when inspector is open", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    const rows = screen.getAllByRole("row");
    await user.click(rows[1]!);
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    rows[1]!.focus();
    expect(rows[1]).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("foo bar");
    });
  });

  it("navigates to the previous row with ArrowUp when inspector is open", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    const rows = screen.getAllByRole("row");
    await user.click(rows[2]!);
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    rows[2]!.focus();
    expect(rows[2]).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    await waitFor(() => {
      expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("hello world");
    });
  });

  it("does not navigate past the first row with ArrowUp", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    const rows = screen.getAllByRole("row");
    await user.click(rows[1]!);
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    rows[1]!.focus();
    expect(rows[1]).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("hello world");
  });

  it("does not navigate past the last row with ArrowDown", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    const rows = screen.getAllByRole("row");
    await user.click(rows[3]!);
    expect(screen.getByText("Row Inspector")).toBeInTheDocument();
    rows[3]!.focus();
    expect(rows[3]).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("aaa");
  });

  it("does not navigate with arrow keys when inspector is closed", async () => {
    const user = userEvent.setup();
    render(<DataTable data={mockData} />);

    const rows = screen.getAllByRole("row");
    rows[1]!.focus();
    expect(rows[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");

    expect(screen.queryByText("Row Inspector")).not.toBeInTheDocument();
  });

  it("does not navigate rows when arrow keys are pressed on pagination controls", async () => {
    const user = userEvent.setup();
    const paginatedData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: Array.from({ length: 30 }, (_, i) => [`row-${i}`]),
    };
    render(<DataTable data={paginatedData} />);
    const nextPageButton = screen.getByRole("button", { name: /next page/i });

    await user.click(screen.getByText("row-0"));
    expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("row-0");

    nextPageButton.focus();
    expect(nextPageButton).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");

    await waitFor(() => {
      expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("row-0");
    });
  });

  it("keeps arrow navigation functional and bounded after pagination changes", async () => {
    const user = userEvent.setup();
    const paginatedData: EsqlResponse = {
      columns: [{ name: "message", type: "keyword" }],
      values: Array.from({ length: 30 }, (_, i) => [`row-${i}`]),
    };
    render(<DataTable data={paginatedData} />);

    await user.click(screen.getByRole("button", { name: /next page/i }));
    await user.click(screen.getByText("row-25"));
    let dataRows = screen.getAllByRole("row", { hidden: true }).slice(1);
    expect(dataRows[0]).toHaveAttribute("data-row-index", "0");
    dataRows[0]!.focus();
    expect(dataRows[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("row-26");
    });
    dataRows = screen.getAllByRole("row", { hidden: true }).slice(1);
    expect(dataRows[1]).toHaveAttribute("data-row-index", "1");
    dataRows[1]!.focus();
    expect(dataRows[1]).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await waitFor(() => {
      expect(screen.getByTestId("row-inspector-field-message")).toHaveTextContent("row-25");
    });
  });
});
