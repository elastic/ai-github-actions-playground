import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TraceErrorAlerts from "../../src/components/traces/TraceErrorAlerts";
import { summarizeError } from "../../src/components/traces/traceUtils";

describe("summarizeError", () => {
  it("summarizes type mismatch errors", () => {
    expect(
      summarizeError(
        "Found 1 problem line 1:62: second argument of [COALESCE(x, y)] must be [long]",
      ),
    ).toBe("A query type mismatch occurred. Results may still be usable.");
  });

  it("summarizes verification errors", () => {
    expect(summarizeError("verification_exception: something went wrong")).toBe(
      "The query encountered a validation issue.",
    );
  });

  it("summarizes Found N problem errors", () => {
    expect(summarizeError("Found 3 problems in the query")).toBe(
      "The query encountered a validation issue.",
    );
  });

  it("summarizes parsing errors", () => {
    expect(summarizeError("parsing_exception: mismatched input")).toBe(
      "The query could not be parsed.",
    );
  });

  it("returns generic summary for unknown errors", () => {
    expect(summarizeError("something completely unexpected")).toBe("A query error occurred.");
  });
});

describe("TraceErrorAlerts", () => {
  it("renders nothing when all errors are null", () => {
    render(<TraceErrorAlerts errors={[null, null]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an alert when there are errors", () => {
    render(<TraceErrorAlerts errors={["parsing_exception: bad query"]} />);
    expect(screen.getByText("Query error")).toBeInTheDocument();
    expect(screen.getByText("The query could not be parsed.")).toBeInTheDocument();
  });

  it("deduplicates identical errors", () => {
    render(<TraceErrorAlerts errors={["parsing_exception: bad", "parsing_exception: bad"]} />);
    expect(screen.getByText("The query could not be parsed.")).toBeInTheDocument();
  });

  it("shows details when expanded", async () => {
    const user = userEvent.setup();
    render(<TraceErrorAlerts errors={["parsing_exception: bad query"]} />);

    expect(screen.queryByText("parsing_exception: bad query")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText("parsing_exception: bad query")).toBeVisible();
  });
});
