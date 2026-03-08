import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataBoundary from "../../src/components/DataBoundary";
import type { DataFetchResult } from "../../src/types/query";

describe("DataBoundary", () => {
  it("renders nothing for idle status by default", () => {
    const result: DataFetchResult<string> = { status: "idle" };
    const { container } = render(
      <DataBoundary result={result}>{(data) => <p>{data}</p>}</DataBoundary>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders custom idle content when provided", () => {
    const result: DataFetchResult<string> = { status: "idle" };
    render(
      <DataBoundary result={result} idle={<p>Not connected</p>}>
        {(data) => <p>{data}</p>}
      </DataBoundary>,
    );
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("renders a LinearProgress by default for loading status", () => {
    const result: DataFetchResult<string> = { status: "loading" };
    render(<DataBoundary result={result}>{(data) => <p>{data}</p>}</DataBoundary>);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders a ContentSkeleton when loading prop is a variant string", () => {
    const result: DataFetchResult<string> = { status: "loading" };
    const { container } = render(
      <DataBoundary result={result} loading="table">
        {(data) => <p>{data}</p>}
      </DataBoundary>,
    );
    // ContentSkeleton renders Skeleton MUI components (with rounded variants)
    // Note: MUI Skeleton has no accessible role; using class selector as fallback.
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders custom loading ReactNode when provided", () => {
    const result: DataFetchResult<string> = { status: "loading" };
    render(
      <DataBoundary result={result} loading={<p>Custom loading…</p>}>
        {(data) => <p>{data}</p>}
      </DataBoundary>,
    );
    expect(screen.getByText("Custom loading…")).toBeInTheDocument();
  });

  it("renders an error Alert for error status", () => {
    const result: DataFetchResult<string> = { status: "error", error: "Network failure" };
    render(<DataBoundary result={result}>{(data) => <p>{data}</p>}</DataBoundary>);
    expect(screen.getByText("Network failure")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows a Retry button when onRetry is provided", async () => {
    const onRetry = vi.fn();
    const result: DataFetchResult<string> = { status: "error", error: "Timeout" };
    render(
      <DataBoundary result={result} onRetry={onRetry}>
        {(data) => <p>{data}</p>}
      </DataBoundary>,
    );
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show Retry button when onRetry is omitted", () => {
    const result: DataFetchResult<string> = { status: "error", error: "Oops" };
    render(<DataBoundary result={result}>{(data) => <p>{data}</p>}</DataBoundary>);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("renders children with data for success status", () => {
    const result: DataFetchResult<string[]> = {
      status: "success",
      data: ["alpha", "beta"],
    };
    render(
      <DataBoundary result={result}>
        {(items) => (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </DataBoundary>,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("transitions from loading to success", () => {
    const loadingResult: DataFetchResult<string> = { status: "loading" };
    const { rerender } = render(
      <DataBoundary result={loadingResult}>{(data) => <p>{data}</p>}</DataBoundary>,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    const successResult: DataFetchResult<string> = { status: "success", data: "Hello" };
    rerender(<DataBoundary result={successResult}>{(data) => <p>{data}</p>}</DataBoundary>);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("transitions from loading to error", () => {
    const loadingResult: DataFetchResult<string> = { status: "loading" };
    const { rerender } = render(
      <DataBoundary result={loadingResult}>{(data) => <p>{data}</p>}</DataBoundary>,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    const errorResult: DataFetchResult<string> = { status: "error", error: "Failed" };
    rerender(<DataBoundary result={errorResult}>{(data) => <p>{data}</p>}</DataBoundary>);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
