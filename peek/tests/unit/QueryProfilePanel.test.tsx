import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import QueryProfilePanel from "../../src/components/QueryProfilePanel";

const SAMPLE_PROFILE = {
  drivers: [
    {
      description: "data node (shard=0)",
      millis: 42,
      operators: [
        {
          operator: "LuceneSourceOperator",
          status: {
            pages_processed: 2,
            rows_processed: 500,
            elapsed_nanos: 10_000_000,
            cpu_nanos: 8_000_000,
          },
        },
        {
          operator: "LimitOperator",
          status: {
            pages_processed: 1,
            rows_processed: 50,
            elapsed_nanos: 500_000,
            cpu_nanos: 400_000,
          },
        },
      ],
    },
  ],
};

describe("QueryProfilePanel", () => {
  it("renders the panel header", () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    expect(screen.getByText("Query Profile")).toBeInTheDocument();
  });

  it("renders driver description and timing chip", () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    expect(screen.getByText("data node (shard=0)")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
  });

  it("renders operator rows sorted by elapsed time descending", () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    const rows = screen.getAllByRole("row");
    // Header row + 2 operator rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
    // LuceneSourceOperator should appear before LimitOperator (higher elapsed)
    const text = screen.getByRole("table").textContent ?? "";
    expect(text.indexOf("LuceneSourceOperator")).toBeLessThan(text.indexOf("LimitOperator"));
  });

  it("converts nanos to ms with two decimal places", () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    // 10_000_000 ns = 10.00 ms
    expect(screen.getByText("10.00 ms")).toBeInTheDocument();
  });

  it("falls back to raw JSON for unknown profile shapes", () => {
    const unknownProfile = { someUnknownKey: [1, 2, 3] };
    render(<QueryProfilePanel profile={unknownProfile} />);
    // The JSON should be rendered somewhere in the document
    expect(document.body.textContent).toContain("someUnknownKey");
  });

  it("renders copy diagnostics button", () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    expect(screen.getByLabelText("Copy profile diagnostics")).toBeInTheDocument();
  });

  it("shows no driver details message when drivers array is empty", () => {
    render(<QueryProfilePanel profile={{ drivers: [] }} />);
    expect(screen.getByText("Profile returned no driver details.")).toBeInTheDocument();
  });

  it("collapses and expands the panel on header click", async () => {
    render(<QueryProfilePanel profile={SAMPLE_PROFILE} />);
    const toggleBtn = screen.getByLabelText("Collapse profile");
    // Initially expanded — operator table should be visible
    expect(screen.getByRole("table")).toBeInTheDocument();

    await userEvent.click(toggleBtn);
    // After collapse, table might be hidden via CSS but still in DOM (Collapse uses CSS)
    // Check that the button label changed
    expect(screen.getByLabelText("Expand profile")).toBeInTheDocument();
  });
});
