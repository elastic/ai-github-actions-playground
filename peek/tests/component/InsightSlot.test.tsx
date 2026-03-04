import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InsightSlot from "../../src/components/InsightSlot";
import { InsightSlotProvider } from "../../src/components/InsightSlotContext";
import type { SlotInsight } from "../../src/types/insightSlots";

const SAMPLE_INSIGHT: SlotInsight = {
  slotId: "cpu-card",
  text: "CPU usage is **high** across 3 nodes.",
  severity: "warning",
};

function renderWithProvider(
  slotId: string,
  insights: SlotInsight[] = [],
  overrides?: { loading?: boolean },
) {
  const refresh = vi.fn();
  const utils = render(
    <InsightSlotProvider
      summary="Page summary"
      insights={insights}
      loading={overrides?.loading ?? false}
      error={null}
      refresh={refresh}
    >
      <InsightSlot slotId={slotId}>
        <span data-testid="child">Child content</span>
      </InsightSlot>
    </InsightSlotProvider>,
  );
  return { ...utils, refresh };
}

describe("InsightSlot", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders children unchanged when no insight exists", () => {
    renderWithProvider("unknown-slot");
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /insight/i })).not.toBeInTheDocument();
  });

  it("renders children unchanged during loading", () => {
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT], { loading: true });
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /insight/i })).not.toBeInTheDocument();
  });

  it("shows indicator dot when insight exists", () => {
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view warning insight/i })).toBeInTheDocument();
  });

  it("opens popover on indicator click and shows markdown content", async () => {
    const user = userEvent.setup();
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    await user.click(screen.getByRole("button", { name: /view warning insight/i }));

    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
    });
    // Markdown bold text
    const bold = screen.getByText("high");
    expect(bold.tagName).toBe("STRONG");
  });

  it("closes popover when dismiss is clicked and hides decoration", async () => {
    const user = userEvent.setup();
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    // Open popover
    await user.click(screen.getByRole("button", { name: /view warning insight/i }));
    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
    });

    // Dismiss
    await user.click(screen.getByRole("button", { name: /dismiss insight/i }));

    // Indicator dot should be gone
    expect(screen.queryByRole("button", { name: /view warning insight/i })).not.toBeInTheDocument();
    // Child content still rendered
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("keeps insight dismissed after remount in same session", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    await user.click(screen.getByRole("button", { name: /view warning insight/i }));
    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /dismiss insight/i }));
    expect(screen.queryByRole("button", { name: /view warning insight/i })).not.toBeInTheDocument();

    unmount();
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    expect(screen.queryByRole("button", { name: /view warning insight/i })).not.toBeInTheDocument();
  });

  it("calls refresh when refresh button is clicked in popover", async () => {
    const user = userEvent.setup();
    const { refresh } = renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    await user.click(screen.getByRole("button", { name: /view warning insight/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh insight/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /refresh insight/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /refresh insight/i })).not.toBeInTheDocument();
    });
  });

  it("opens popover via keyboard (Enter) and closes with Escape", async () => {
    const user = userEvent.setup();
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    const dot = screen.getByRole("button", { name: /view warning insight/i });

    // Focus and press Enter to open
    dot.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
    });

    // Press Escape to close the popover
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("high")).not.toBeInTheDocument();
    });
  });

  it("opens popover via Space key", async () => {
    const user = userEvent.setup();
    renderWithProvider("cpu-card", [SAMPLE_INSIGHT]);

    const dot = screen.getByRole("button", { name: /view warning insight/i });

    // Focus and press Space to open
    dot.focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(screen.getByText("high")).toBeInTheDocument();
    });
  });

  it("renders with info severity as default when severity is absent", () => {
    const insight: SlotInsight = { slotId: "idx", text: "42 indices" };
    renderWithProvider("idx", [insight]);
    expect(screen.getByRole("button", { name: /view info insight/i })).toBeInTheDocument();
  });
});
