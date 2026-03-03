import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TraceTable } from "../../src/components/traces/TraceTable";

const baseRow = {
  traceId: "abc123def456ghi7",
  spanId: "span-1",
  serviceName: "checkout",
  name: "GET /checkout",
  durationUs: 1000,
  timestamp: "2026-02-23T10:00:00.000Z",
};

describe("TraceTable status column", () => {
  it("renders 'OK' chip for successful status", () => {
    render(
      <TraceTable
        traceRows={[{ ...baseRow, status: "STATUS_CODE_OK" }]}
        selectedTraceId={null}
        onSelectTrace={() => {}}
        maxDuration={1000}
      />,
    );

    const chip = screen.getByText("OK");
    expect(chip).toBeInTheDocument();
    expect(screen.getByLabelText("Status: OK")).toBeInTheDocument();
  });

  it("renders 'Error' chip for error status", () => {
    render(
      <TraceTable
        traceRows={[{ ...baseRow, status: "Error" }]}
        selectedTraceId={null}
        onSelectTrace={() => {}}
        maxDuration={1000}
      />,
    );

    const chip = screen.getByText("Error");
    expect(chip).toBeInTheDocument();
    expect(screen.getByLabelText("Status: Error")).toBeInTheDocument();
  });

  it("renders 'Error' chip for STATUS_CODE_ERROR", () => {
    render(
      <TraceTable
        traceRows={[{ ...baseRow, status: "STATUS_CODE_ERROR" }]}
        selectedTraceId={null}
        onSelectTrace={() => {}}
        maxDuration={1000}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: Error")).toBeInTheDocument();
  });
});
