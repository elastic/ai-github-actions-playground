import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ColumnInsightsFlyout from "../../src/components/visualizations/ColumnInsightsFlyout";
import type { EsqlResponse } from "../../src/types";

const numericData: EsqlResponse = {
  columns: [
    { name: "min_value", type: "double" },
    { name: "max_value", type: "double" },
    { name: "avg_value", type: "double" },
    { name: "total_count", type: "long" },
    { name: "null_count", type: "long" },
  ],
  values: [[1.5, 99.0, 42.3, 1000, 50]],
};

const keywordData: EsqlResponse = {
  columns: [
    { name: "status", type: "keyword" },
    { name: "count", type: "long" },
  ],
  values: [
    ["200", 850],
    ["404", 120],
    ["500", 30],
  ],
};

describe("ColumnInsightsFlyout", () => {
  it("renders the column name and type in the header", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="response_time"
        columnType="double"
        loading={false}
        error={null}
        data={numericData}
      />,
    );

    expect(screen.getByText("Column Insights")).toBeInTheDocument();
    expect(screen.getByText("response_time")).toBeInTheDocument();
    expect(screen.getByText("double")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ColumnInsightsFlyout
        open
        onClose={onClose}
        columnName="count"
        columnType="long"
        loading={false}
        error={null}
        data={numericData}
      />,
    );

    await user.click(screen.getByRole("button", { name: /close insights/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a loading spinner when loading is true", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="count"
        columnType="long"
        loading
        error={null}
        data={null}
      />,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows an error alert when error is provided", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="count"
        columnType="long"
        loading={false}
        error="Query failed: index not found"
        data={null}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Query failed: index not found")).toBeInTheDocument();
  });

  it("renders min/max/avg/total/null stats for a numeric column", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="response_time"
        columnType="double"
        loading={false}
        error={null}
        data={numericData}
      />,
    );

    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();
    expect(screen.getByText("Avg")).toBeInTheDocument();
    expect(screen.getByText("42.3")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("99")).toBeInTheDocument();
    expect(screen.getByText("Total count")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("Null count")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("Null rate")).toBeInTheDocument();
    expect(screen.getByText("5.0%")).toBeInTheDocument();
  });

  it("renders top values table for a keyword column", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="status"
        columnType="keyword"
        loading={false}
        error={null}
        data={keywordData}
      />,
    );

    expect(screen.getByText(/Top 3 values/i)).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("850")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("shows 'Showing top 10 values only' when there are 10 or more rows", () => {
    const bigData: EsqlResponse = {
      columns: [
        { name: "status", type: "keyword" },
        { name: "count", type: "long" },
      ],
      values: Array.from({ length: 10 }, (_, i) => [`value${i}`, 100 - i]),
    };

    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="status"
        columnType="keyword"
        loading={false}
        error={null}
        data={bigData}
      />,
    );

    expect(screen.getByText("Showing top 10 values only")).toBeInTheDocument();
  });

  it("shows 'No data available' when data is null and not loading", () => {
    render(
      <ColumnInsightsFlyout
        open
        onClose={vi.fn()}
        columnName="count"
        columnType="long"
        loading={false}
        error={null}
        data={null}
      />,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("does not render content when open is false", () => {
    render(
      <ColumnInsightsFlyout
        open={false}
        onClose={vi.fn()}
        columnName="count"
        columnType="long"
        loading={false}
        error={null}
        data={numericData}
      />,
    );

    expect(screen.queryByText("Column Insights")).not.toBeInTheDocument();
  });
});
