import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SpanDetailDrawer from "../../src/components/traces/SpanDetailDrawer";
import type { Span } from "../../src/components/traces/traceUtils";

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: "trace-abc",
    spanId: "span-xyz",
    parentSpanId: null,
    serviceName: "test-service",
    name: "GET /api",
    kind: "SERVER",
    durationUs: 1000,
    status: "OK",
    timestamp: "2026-01-01T00:00:00.000Z",
    startTimeUs: new Date("2026-01-01T00:00:00.000Z").getTime() * 1000,
    attributes: {},
    ...overrides,
  };
}

describe("SpanDetailDrawer – Links tab", () => {
  it("shows empty state when span has no links", async () => {
    const span = makeSpan({ links: [] });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByText("No span links")).toBeInTheDocument();
  });

  it("shows empty state when span.links is undefined", async () => {
    const span = makeSpan(); // no links field
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByText("No span links")).toBeInTheDocument();
  });

  it("renders link trace and span IDs", async () => {
    const span = makeSpan({
      links: [{ traceId: "linked-trace-1", spanId: "linked-span-1", attributes: {} }],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByText("Link 1")).toBeInTheDocument();
    expect(screen.getByText("linked-trace-1")).toBeInTheDocument();
    expect(screen.getByText("linked-span-1")).toBeInTheDocument();
  });

  it("renders multiple links", async () => {
    const span = makeSpan({
      links: [
        { traceId: "t1", spanId: "s1", attributes: {} },
        { traceId: "t2", spanId: "s2", attributes: {} },
      ],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByText("Link 1")).toBeInTheDocument();
    expect(screen.getByText("Link 2")).toBeInTheDocument();
    expect(screen.getByText("t1")).toBeInTheDocument();
    expect(screen.getByText("t2")).toBeInTheDocument();
  });

  it("renders link attributes", async () => {
    const span = makeSpan({
      links: [
        {
          traceId: "t1",
          spanId: "s1",
          attributes: { "messaging.system": "kafka" },
        },
      ],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Links" }));
    expect(screen.getByText("messaging.system")).toBeInTheDocument();
    expect(screen.getByText("kafka")).toBeInTheDocument();
  });
});

describe("SpanDetailDrawer – Events tab", () => {
  it("shows empty state when span has no events", async () => {
    const span = makeSpan({ events: [] });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("No events")).toBeInTheDocument();
  });

  it("shows empty state when span.events is undefined", async () => {
    const span = makeSpan(); // no events field
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("No events")).toBeInTheDocument();
  });

  it("renders event name and timestamp", async () => {
    const span = makeSpan({
      events: [
        {
          name: "exception",
          timestamp: "2026-01-15T10:23:45.123Z",
          attributes: {},
        },
      ],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("exception")).toBeInTheDocument();
    expect(screen.getByText("2026-01-15T10:23:45.123Z")).toBeInTheDocument();
  });

  it("renders event attributes", async () => {
    const span = makeSpan({
      events: [
        {
          name: "exception",
          timestamp: "2026-01-15T10:23:45.123Z",
          attributes: { "exception.type": "RuntimeException" },
        },
      ],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("exception.type")).toBeInTheDocument();
    expect(screen.getByText("RuntimeException")).toBeInTheDocument();
  });

  it("shows 'No attributes' for events with no attributes", async () => {
    const span = makeSpan({
      events: [{ name: "checkpoint", timestamp: "2026-01-15T10:23:45.000Z", attributes: {} }],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("No attributes")).toBeInTheDocument();
  });

  it("renders fallback name for unnamed events", async () => {
    const span = makeSpan({
      events: [{ name: "", timestamp: "", attributes: {} }],
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("(unnamed event)")).toBeInTheDocument();
  });
});

describe("SpanDetailDrawer – invalid timestamp", () => {
  it("renders without crashing and shows the raw value when span.timestamp is invalid", () => {
    const span = makeSpan({ timestamp: "not-a-date" });
    expect(() =>
      render(
        <SpanDetailDrawer
          span={span}
          open
          onClose={vi.fn()}
          onFilterBy={vi.fn()}
          onExclude={vi.fn()}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });
});

describe("SpanDetailDrawer – copy action", () => {
  it("does not throw when navigator.clipboard is unavailable", async () => {
    const user = userEvent.setup();
    const span = makeSpan({
      attributes: { "http.method": "GET" },
    });
    // Simulate environment without Clipboard API
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });

    try {
      render(
        <SpanDetailDrawer
          span={span}
          open
          onClose={vi.fn()}
          onFilterBy={vi.fn()}
          onExclude={vi.fn()}
        />,
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy/i });
      await expect(user.click(copyButtons[0])).resolves.toBeUndefined();
    } finally {
      // Always restore the original clipboard descriptor
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      }
    }
  });
});

describe("SpanDetailDrawer – Footer actions", () => {
  it("calls query lab callback with span context", async () => {
    const user = userEvent.setup();
    const onOpenInQueryLab = vi.fn();
    const span = makeSpan({
      traceId: "trace-footer",
      spanId: "span-footer",
      timestamp: "2026-02-01T00:00:00.000Z",
    });
    render(
      <SpanDetailDrawer
        span={span}
        open
        onClose={vi.fn()}
        onFilterBy={vi.fn()}
        onExclude={vi.fn()}
        onOpenInQueryLab={onOpenInQueryLab}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open in Query Lab" }));
    expect(onOpenInQueryLab).toHaveBeenCalledWith({
      traceId: "trace-footer",
      spanId: "span-footer",
      timestamp: "2026-02-01T00:00:00.000Z",
    });
  });
});
