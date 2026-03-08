import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataFetchAlert from "../../src/components/DataFetchAlert";
import type { DataFetchResult } from "../../src/types/query";

describe("DataFetchAlert", () => {
  it("renders nothing for idle status", () => {
    const result: DataFetchResult<string> = { status: "idle" };
    const { container } = render(<DataFetchAlert result={result} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for loading status", () => {
    const result: DataFetchResult<string> = { status: "loading" };
    const { container } = render(<DataFetchAlert result={result} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for success status", () => {
    const result: DataFetchResult<string> = { status: "success", data: "ok" };
    const { container } = render(<DataFetchAlert result={result} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders an error Alert for error status", () => {
    const result: DataFetchResult<string> = { status: "error", error: "Cluster unavailable" };
    render(<DataFetchAlert result={result} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Cluster unavailable")).toBeInTheDocument();
  });

  it("shows a Retry button when onRetry is provided", async () => {
    const onRetry = vi.fn();
    const result: DataFetchResult<string> = { status: "error", error: "Timeout" };
    render(<DataFetchAlert result={result} onRetry={onRetry} />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not show Retry button when onRetry is omitted", () => {
    const result: DataFetchResult<string> = { status: "error", error: "Oops" };
    render(<DataFetchAlert result={result} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});
