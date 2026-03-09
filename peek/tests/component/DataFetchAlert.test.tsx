import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataFetchAlert from "../../src/components/DataFetchAlert";
import type { DataFetchResult } from "../../src/types/query";

describe("DataFetchAlert", () => {
  describe("result prop API", () => {
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

    it("wraps in a padded Box when using result prop", () => {
      const result: DataFetchResult<string> = { status: "error", error: "fail" };
      const { container } = render(<DataFetchAlert result={result} />);
      const box = container.firstElementChild as HTMLElement | null;
      expect(box?.tagName).toBe("DIV");
      expect(box?.querySelector("[role='alert']")).toBeInTheDocument();
      expect(box ? getComputedStyle(box).padding : "").toBe("16px");
    });
  });

  describe("error string prop API", () => {
    it("renders nothing for null error", () => {
      const { container } = render(<DataFetchAlert error={null} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing for undefined error", () => {
      const { container } = render(<DataFetchAlert error={undefined} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing for empty string error", () => {
      const { container } = render(<DataFetchAlert error="" />);
      expect(container.innerHTML).toBe("");
    });

    it("renders an error Alert for a truthy error string", () => {
      render(<DataFetchAlert error="Network failure" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });

    it("renders inline without a padded Box wrapper", () => {
      const { container } = render(<DataFetchAlert error="inline error" />);
      const firstChild = container.firstElementChild;
      expect(firstChild?.getAttribute("role")).toBe("alert");
    });

    it("shows a Retry button when onRetry is provided", async () => {
      const onRetry = vi.fn();
      render(<DataFetchAlert error="Timeout" onRetry={onRetry} />);
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      await userEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("shows a close button when onDismiss is provided", async () => {
      const onDismiss = vi.fn();
      render(<DataFetchAlert error="Dismissable" onDismiss={onDismiss} />);
      const closeBtn = screen.getByRole("button", { name: /close/i });
      await userEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("shows both Retry and close buttons when onRetry and onDismiss are provided", async () => {
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      render(<DataFetchAlert error="Dismissable" onRetry={onRetry} onDismiss={onDismiss} />);
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      const closeBtn = screen.getByRole("button", { name: /close/i });
      await userEvent.click(retryBtn);
      await userEvent.click(closeBtn);
      expect(onRetry).toHaveBeenCalledOnce();
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("forwards sx prop to the Alert", () => {
      render(<DataFetchAlert error="styled" sx={{ marginBottom: "17px" }} />);
      const alert = screen.getByRole("alert");
      expect(getComputedStyle(alert).marginBottom).toBe("17px");
    });
  });
});
