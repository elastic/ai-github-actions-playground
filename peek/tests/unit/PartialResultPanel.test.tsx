import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithA11y } from "../helpers/renderWithA11y";
import PartialResultPanel from "../../src/components/PartialResultPanel";

const SAMPLE_SHARDS_METADATA = {
  _shards: {
    total: 5,
    successful: 3,
    skipped: 0,
    failed: 2,
    failures: [
      {
        shard: 1,
        index: "logs-2025.01.01",
        node: "node-a",
        reason: { type: "search_phase_execution_exception", reason: "shard timed out" },
      },
      {
        shard: 3,
        index: "logs-2025.01.02",
        reason: { type: "no_shard_available_action_exception", reason: "no shard available" },
      },
    ],
  },
};

const SAMPLE_CLUSTERS_METADATA = {
  _clusters: {
    total: 3,
    successful: 1,
    skipped: 0,
    running: 0,
    partial: 1,
    failed: 1,
    details: {
      "cluster-a": {
        status: "successful",
        timed_out: false,
        indices: "logs-*",
        took: 120,
      },
      "cluster-b": {
        status: "partial",
        timed_out: true,
        indices: "logs-*",
        took: 5000,
        _shards: { total: 4, successful: 2, failed: 2 },
      },
      "cluster-c": {
        status: "failed",
        timed_out: false,
        indices: "logs-*",
        failures: [{ index: "logs-*", reason: { type: "connect_timeout", reason: "unreachable" } }],
      },
    },
  },
};

describe("PartialResultPanel", () => {
  it("has no accessibility violations", async () => {
    await renderWithA11y(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
  });

  it("renders the panel header with warning icon", () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    expect(screen.getByText("Partial Results")).toBeInTheDocument();
  });

  it("shows failed shard count chip when shards failed", () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    expect(screen.getByText("2 shards failed")).toBeInTheDocument();
  });

  it("shows shard summary line", () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    expect(screen.getByText(/3\/5 successful/)).toBeInTheDocument();
  });

  it("renders shard failure reasons", () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    expect(screen.getByText(/shard timed out/)).toBeInTheDocument();
    expect(screen.getByText(/no shard available/)).toBeInTheDocument();
  });

  it("shows cluster-level diagnostics for cross-cluster metadata", () => {
    render(<PartialResultPanel metadata={SAMPLE_CLUSTERS_METADATA} />);
    // Only unhealthy clusters should appear
    expect(screen.getByText("cluster-b")).toBeInTheDocument();
    expect(screen.getByText("cluster-c")).toBeInTheDocument();
    // Healthy cluster should not appear
    expect(screen.queryByText("cluster-a")).not.toBeInTheDocument();
  });

  it("shows affected cluster count chip", () => {
    render(<PartialResultPanel metadata={SAMPLE_CLUSTERS_METADATA} />);
    expect(screen.getByText("2 clusters affected")).toBeInTheDocument();
  });

  it("shows timed-out chip for timed-out cluster", () => {
    render(<PartialResultPanel metadata={SAMPLE_CLUSTERS_METADATA} />);
    expect(screen.getByText("timed out")).toBeInTheDocument();
  });

  it("renders copy diagnostics button", () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    expect(screen.getByLabelText("Copy partial result diagnostics")).toBeInTheDocument();
  });

  it("collapses and expands the panel on header click", async () => {
    render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
    const toggleBtn = screen.getByLabelText("Collapse partial result details");
    expect(toggleBtn).toBeInTheDocument();

    await userEvent.click(toggleBtn);
    expect(screen.getByLabelText("Expand partial result details")).toBeInTheDocument();
  });

  it("shows re-run button when healthy clusters exist and callback is provided", () => {
    const onRerun = vi.fn();
    render(
      <PartialResultPanel metadata={SAMPLE_CLUSTERS_METADATA} onRerunHealthyClusters={onRerun} />,
    );
    expect(screen.getByText("Re-run on healthy clusters")).toBeInTheDocument();
  });

  it("calls onRerunHealthyClusters with healthy cluster names", async () => {
    const onRerun = vi.fn();
    render(
      <PartialResultPanel metadata={SAMPLE_CLUSTERS_METADATA} onRerunHealthyClusters={onRerun} />,
    );
    // The button's aria-label comes from the Tooltip title; find it by visible text
    const btn = screen.getByText("Re-run on healthy clusters");
    await userEvent.click(btn);
    expect(onRerun).toHaveBeenCalledWith(["cluster-a"]);
  });

  it("does not show re-run button when no healthy clusters exist", () => {
    const allFailedMeta = {
      _clusters: {
        total: 1,
        successful: 0,
        failed: 1,
        details: { "cluster-x": { status: "failed" } },
      },
    };
    const onRerun = vi.fn();
    render(<PartialResultPanel metadata={allFailedMeta} onRerunHealthyClusters={onRerun} />);
    expect(screen.queryByText("Re-run on healthy clusters")).toBeNull();
  });

  it("renders fallback message when no diagnostic details are available", () => {
    render(<PartialResultPanel metadata={{}} />);
    expect(screen.getByText(/No diagnostic details available/)).toBeInTheDocument();
  });

  it("returns null for non-object metadata", () => {
    const { container } = render(<PartialResultPanel metadata={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not crash when Clipboard API is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    try {
      render(<PartialResultPanel metadata={SAMPLE_SHARDS_METADATA} />);
      await userEvent.click(screen.getByLabelText("Copy partial result diagnostics"));
      expect(screen.getByText("Partial Results")).toBeInTheDocument();
    } finally {
      if (original !== undefined) {
        Object.defineProperty(navigator, "clipboard", original);
      }
    }
  });
});
