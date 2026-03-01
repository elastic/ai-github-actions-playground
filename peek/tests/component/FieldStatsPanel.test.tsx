import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import FieldStatsPanel from "../../src/components/FieldStatsPanel";
import { resetAllStores } from "../fixtures/test-utils";
import type { FieldStats } from "../../src/services/es";

const { fetchFieldStatsMock } = vi.hoisted(() => ({ fetchFieldStatsMock: vi.fn() }));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({})),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
  fetchFieldStats: fetchFieldStatsMock,
  buildFieldStatsQuery: (index: string, field: string) =>
    `FROM ${index} | STATS total = COUNT(*), non_null = COUNT(\`${field}\`), cardinality = COUNT_DISTINCT(\`${field}\`)`,
  buildTopValuesQuery: (index: string, field: string) =>
    `FROM ${index} | STATS count = COUNT(*) BY \`${field}\` | SORT count DESC | LIMIT 10`,
  buildMinMaxQuery: (index: string, field: string) =>
    `FROM ${index} | STATS min_val = MIN(\`${field}\`), max_val = MAX(\`${field}\`)`,
  isKeywordLikeType: (type: string) =>
    ["keyword", "constant_keyword", "wildcard", "text", "ip", "boolean", "version"].includes(type),
  isNumericOrDateType: (type: string) =>
    [
      "integer",
      "long",
      "short",
      "byte",
      "double",
      "float",
      "half_float",
      "scaled_float",
      "unsigned_long",
      "counter_long",
      "counter_double",
      "counter_integer",
      "aggregate_metric_double",
      "date",
      "date_nanos",
    ].includes(type),
}));

const connection = { url: "https://example.es.local:9200", apiKey: "key" };
const noop = () => {};

function keywordStats(overrides: Partial<FieldStats> = {}): FieldStats {
  return {
    fieldName: "host.name",
    fieldType: "keyword",
    totalCount: 1000,
    nonNullCount: 900,
    nullPercent: 10,
    cardinality: 5,
    topValues: [
      { value: "web-01", count: 600 },
      { value: "web-02", count: 300 },
    ],
    sampleCoverage: 0.02,
    confidence: "high",
    ...overrides,
  };
}

function numericStats(overrides: Partial<FieldStats> = {}): FieldStats {
  return {
    fieldName: "event.duration",
    fieldType: "long",
    totalCount: 5000,
    nonNullCount: 5000,
    nullPercent: 0,
    cardinality: 200,
    min: 0,
    max: 99999,
    sampleCoverage: 0.1,
    confidence: "high",
    ...overrides,
  };
}

describe("FieldStatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it("shows a loading spinner while fetching stats", () => {
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("displays counts and top values for a keyword field", async () => {
    fetchFieldStatsMock.mockResolvedValue(keywordStats());

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-total");

    expect(screen.getByTestId("field-stats-total")).toHaveTextContent("1,000");
    expect(screen.getByTestId("field-stats-non-null")).toHaveTextContent("900");
    expect(screen.getByTestId("field-stats-null-pct")).toHaveTextContent("10.0%");
    expect(screen.getByTestId("field-stats-cardinality")).toHaveTextContent("5");
    expect(screen.getByText("web-01")).toBeInTheDocument();
    expect(screen.getByText("web-02")).toBeInTheDocument();
    // Should not show min/max for keyword
    expect(screen.queryByTestId("field-stats-min")).not.toBeInTheDocument();
    expect(screen.queryByTestId("field-stats-max")).not.toBeInTheDocument();
  });

  it("displays min/max for a numeric field without top values", async () => {
    fetchFieldStatsMock.mockResolvedValue(numericStats());

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="event.duration"
          fieldType="long"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-min");

    expect(screen.getByTestId("field-stats-min")).toHaveTextContent("0");
    expect(screen.getByTestId("field-stats-max")).toHaveTextContent("99999");
    // Should not show "Top values" section for numeric
    expect(screen.queryByText("Top values")).not.toBeInTheDocument();
  });

  it("displays min/max with em-dash when values are null", async () => {
    fetchFieldStatsMock.mockResolvedValue(numericStats({ min: null, max: null }));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="event.duration"
          fieldType="long"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-min");
    expect(screen.getByTestId("field-stats-min")).toHaveTextContent("—");
    expect(screen.getByTestId("field-stats-max")).toHaveTextContent("—");
  });

  it("shows an error alert when the stats request fails", async () => {
    fetchFieldStatsMock.mockRejectedValue({ status: 403, message: "Forbidden" });

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={handleClose}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /close field stats/i }));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("passes the top-values ES|QL query to onOpenInQueryLab for keyword fields", async () => {
    const user = userEvent.setup();
    const handleOpen = vi.fn();
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={handleOpen}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("field-stats-open-in-query-lab"));
    expect(handleOpen).toHaveBeenCalledOnce();
    const [query] = handleOpen.mock.calls[0] as [string];
    expect(query).toContain("SORT count DESC");
    expect(query).toContain("`host.name`");
  });

  it("passes the min/max ES|QL query to onOpenInQueryLab for numeric fields", async () => {
    const user = userEvent.setup();
    const handleOpen = vi.fn();
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="event.duration"
          fieldType="long"
          onClose={noop}
          onOpenInQueryLab={handleOpen}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("field-stats-open-in-query-lab"));
    expect(handleOpen).toHaveBeenCalledOnce();
    const [query] = handleOpen.mock.calls[0] as [string];
    expect(query).toContain("MIN(`event.duration`)");
    expect(query).toContain("MAX(`event.duration`)");
  });

  it("shows empty-state message when keyword field has no top values", async () => {
    fetchFieldStatsMock.mockResolvedValue(keywordStats({ topValues: [] }));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByText("No values found.");
  });

  it("shows field name and type chip in the header", async () => {
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("host.name")).toBeInTheDocument();
    expect(screen.getByText("keyword")).toBeInTheDocument();
  });

  it('renders a "High confidence" badge for a small stream', async () => {
    fetchFieldStatsMock.mockResolvedValue(
      keywordStats({ totalCount: 1000, sampleCoverage: 0.02, confidence: "high" }),
    );

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-confidence-badge");
    expect(screen.getByTestId("field-stats-confidence-badge")).toHaveTextContent("High confidence");
  });

  it('renders a "Medium confidence" badge when the stream approaches the sample limit', async () => {
    fetchFieldStatsMock.mockResolvedValue(
      keywordStats({ totalCount: 40000, sampleCoverage: 0.8, confidence: "medium" }),
    );

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-confidence-badge");
    expect(screen.getByTestId("field-stats-confidence-badge")).toHaveTextContent(
      "Medium confidence",
    );
  });

  it('renders a "Low confidence" badge when the sample limit is reached', async () => {
    fetchFieldStatsMock.mockResolvedValue(
      keywordStats({ totalCount: 50000, sampleCoverage: 1.0, confidence: "low" }),
    );

    render(
      <MemoryRouter>
        <FieldStatsPanel
          connection={connection}
          streamName="logs-app"
          fieldName="host.name"
          fieldType="keyword"
          onClose={noop}
          onOpenInQueryLab={noop}
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("field-stats-confidence-badge");
    expect(screen.getByTestId("field-stats-confidence-badge")).toHaveTextContent("Low confidence");
  });
});
