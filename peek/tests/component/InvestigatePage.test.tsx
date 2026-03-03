import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import InvestigatePage from "../../src/components/InvestigatePage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: queryMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({
    execute: queryMock,
  }),
}));

const ESQL_RESPONSE = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "event.category", type: "keyword" },
    { name: "event.action", type: "keyword" },
    { name: "event.outcome", type: "keyword" },
    { name: "user.name", type: "keyword" },
    { name: "host.name", type: "keyword" },
    { name: "source.ip", type: "ip" },
    { name: "message", type: "text" },
    { name: "_index", type: "keyword" },
  ],
  values: [
    [
      "2026-03-01T10:00:00.000Z",
      "authentication",
      "logon",
      "success",
      "admin",
      "web-server-01",
      "192.168.1.10",
      "User admin logged in",
      "logs-security-default",
    ],
    [
      "2026-03-01T09:55:00.000Z",
      "authentication",
      "logon",
      "failure",
      "admin",
      "web-server-01",
      "192.168.1.10",
      "Failed login attempt",
      "auditbeat-2026.03.01",
    ],
  ],
};

const EMPTY_ESQL_RESPONSE = { columns: [], values: [] };

describe("InvestigatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    queryMock.mockResolvedValue(EMPTY_ESQL_RESPONSE);
  });

  it("renders the page header and search controls", () => {
    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    expect(screen.getByText("Investigate")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /host/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /user name/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("shows initial empty state prompting to search", async () => {
    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await screen.findByText("Investigate a user");
  });

  it("switches to host tab and updates placeholder", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /host/i }));

    expect(screen.getByRole("textbox", { name: /host name/i })).toBeInTheDocument();
    await screen.findByText("Investigate a host");
  });

  it("preserves loaded suggestions when switching back to a tab", async () => {
    const USER_SUGGESTIONS_RESPONSE = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "user.name", type: "keyword" },
      ],
      values: [[42, "2026-03-01T10:00:00Z", "admin"]],
    };
    const HOST_SUGGESTIONS_RESPONSE = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "host.name", type: "keyword" },
      ],
      values: [[17, "2026-03-01T10:00:00Z", "web-01"]],
    };
    queryMock
      .mockResolvedValueOnce(USER_SUGGESTIONS_RESPONSE)
      .mockResolvedValueOnce(HOST_SUGGESTIONS_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await screen.findByText("admin (42)");
    await user.click(screen.getByRole("tab", { name: /host/i }));
    await screen.findByText("web-01 (17)");
    await user.click(screen.getByRole("tab", { name: /user/i }));
    expect(screen.getByText("admin (42)")).toBeInTheDocument();
  });

  it("displays search results in a timeline table", async () => {
    queryMock.mockResolvedValueOnce(EMPTY_ESQL_RESPONSE).mockResolvedValueOnce(ESQL_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "admin");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText(/2 events found/i);
    expect(screen.getByText("logs-security-default")).toBeInTheDocument();
    expect(screen.getByText("auditbeat-2026.03.01")).toBeInTheDocument();
    expect(screen.getByText("User admin logged in")).toBeInTheDocument();
    expect(screen.getByText("Failed login attempt")).toBeInTheDocument();
  });

  it("shows empty state when no events are found", async () => {
    queryMock.mockResolvedValue(EMPTY_ESQL_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "unknown-user");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText(/no events found/i);
  });

  it("shows error alert on query failure", async () => {
    queryMock
      .mockResolvedValueOnce(EMPTY_ESQL_RESPONSE)
      .mockRejectedValueOnce({ status: 400, message: "verification_exception" });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "admin");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("verification_exception");
  });

  it("shows LLM summary prompt section when events are found", async () => {
    queryMock.mockResolvedValueOnce(EMPTY_ESQL_RESPONSE).mockResolvedValueOnce(ESQL_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "admin");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("LLM Summary");
    expect(screen.getByRole("button", { name: /copy prompt to clipboard/i })).toBeInTheDocument();
  });

  it("shows category and data source breakdowns", async () => {
    queryMock.mockResolvedValueOnce(EMPTY_ESQL_RESPONSE).mockResolvedValueOnce(ESQL_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "admin");
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText(/authentication \(2\)/i);
    expect(screen.getByText(/logs-security-default \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/auditbeat-2026\.03\.01 \(1\)/i)).toBeInTheDocument();
  });

  it("disables search button when input is empty", () => {
    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
  });

  it("triggers search on Enter key press", async () => {
    queryMock.mockResolvedValueOnce(EMPTY_ESQL_RESPONSE).mockResolvedValueOnce(ESQL_RESPONSE);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    const input = screen.getByRole("textbox", { name: /user name/i });
    await user.type(input, "admin{enter}");

    await screen.findByText(/2 events found/i);
  });

  it("shows recent entity suggestions when data is available", async () => {
    const SUGGESTIONS_RESPONSE = {
      columns: [
        { name: "event_count", type: "long" },
        { name: "last_seen", type: "date" },
        { name: "user.name", type: "keyword" },
      ],
      values: [
        [42, "2026-03-01T10:00:00Z", "admin"],
        [18, "2026-03-01T09:00:00Z", "guest"],
      ],
    };
    queryMock.mockResolvedValueOnce(SUGGESTIONS_RESPONSE);

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await screen.findByText("Recent users");
    expect(screen.getByText("admin (42)")).toBeInTheDocument();
    expect(screen.getByText("guest (18)")).toBeInTheDocument();
  });

  it("shows a circular spinner inside the search button while loading", async () => {
    queryMock.mockResolvedValueOnce(EMPTY_ESQL_RESPONSE).mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <InvestigatePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: /user name/i }), "admin");
    await user.click(screen.getByRole("button", { name: /search/i }));

    const spinner = screen.getByRole("progressbar");
    expect(spinner).toBeInTheDocument();
    // Verify the spinner is rendered inside a button element
    const buttons = screen.getAllByRole("button");
    const buttonWithSpinner = buttons.find((btn) => within(btn).queryByRole("progressbar"));
    expect(buttonWithSpinner).toBeDefined();
  });
});
