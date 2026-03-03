// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

import { buildChatRuntime } from "../../src/services/chatRuntime";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/services/elasticDocsMcp", () => ({
  getElasticDocsTools: vi.fn().mockResolvedValue({}),
  resetMcpSession: vi.fn(),
}));

const defaultConfig = {
  provider: "openai" as const,
  model: "gpt-4",
  apiKey: "sk-test",
  elasticDocsEnabled: false,
};

describe("buildChatRuntime — new tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    // Set location so get_screen_context reads the correct pathname
    window.history.pushState({}, "", "/discover");
  });

  it("includes get_screen_context tool", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    expect(tools).toHaveProperty("get_screen_context");
  });

  it("get_screen_context returns page info", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    const ctx = tools.get_screen_context as {
      execute: (args: { include_data?: boolean }) => Promise<unknown>;
    };
    const result = await ctx.execute({ include_data: false });
    expect(result).toHaveProperty("page");
    expect((result as { page: { label: string } }).page.label).toBe("Query Lab");
  });

  it("includes navigate_to_page tool when navigate is provided", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
      navigate,
    });
    expect(tools).toHaveProperty("navigate_to_page");
  });

  it("does not include browser control tools when navigate is not provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    expect(tools).not.toHaveProperty("navigate_to_page");
    expect(tools).not.toHaveProperty("set_query_lab_query");
    expect(tools).not.toHaveProperty("set_time_range");
  });

  it("navigate_to_page calls navigate with correct path", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
      navigate,
    });
    const navTool = tools.navigate_to_page as {
      execute: (args: { page: string }) => Promise<unknown>;
    };
    const result = await navTool.execute({ page: "traces" });
    expect(navigate).toHaveBeenCalledWith("/traces");
    expect(result).toEqual({ navigated: "traces", path: "/traces", label: "Traces" });
  });

  it("includes set_query_lab_query tool when navigate is provided", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/traces",
      navigate,
    });
    expect(tools).toHaveProperty("set_query_lab_query");
  });

  it("set_query_lab_query sets draft and navigates to discover", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/traces",
      navigate,
    });
    const queryTool = tools.set_query_lab_query as {
      execute: (args: { query: string }) => Promise<unknown>;
    };
    await queryTool.execute({ query: "FROM metrics-* | LIMIT 10" });
    expect(useQueryStore.getState().discoverQueryDraft).toBe("FROM metrics-* | LIMIT 10");
    expect(navigate).toHaveBeenCalledWith("/discover");
  });

  it("includes set_time_range tool when navigate is provided", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/dashboards",
      navigate,
    });
    expect(tools).toHaveProperty("set_time_range");
  });

  it("set_time_range updates dashboard time range", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/dashboards",
      navigate,
    });
    const timeTool = tools.set_time_range as {
      execute: (args: { from: string; to: string }) => Promise<unknown>;
    };
    const result = await timeTool.execute({ from: "now-1h", to: "now" });
    expect(result).toEqual({ set: true, from: "now-1h", to: "now" });
    const dashState = useDashboardStore.getState();
    expect(dashState.dashboard.timeRange).toEqual({ from: "now-1h", to: "now" });
  });

  it("set_time_range schema rejects invalid date-math expressions", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/dashboards",
      navigate,
    });
    const timeTool = tools.set_time_range as {
      inputSchema: { parse: (v: unknown) => unknown };
    };
    expect(() => timeTool.inputSchema.parse({ from: "invalid!", to: "now" })).toThrow();
    expect(() => timeTool.inputSchema.parse({ from: "now-1h", to: "garbage" })).toThrow();
  });

  it("set_time_range schema accepts date-math and ISO dates", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/dashboards",
      navigate,
    });
    const timeTool = tools.set_time_range as {
      inputSchema: { parse: (v: unknown) => unknown };
    };
    expect(() => timeTool.inputSchema.parse({ from: "now-1h", to: "now" })).not.toThrow();
    expect(() => timeTool.inputSchema.parse({ from: "now/d", to: "now" })).not.toThrow();
    expect(() =>
      timeTool.inputSchema.parse({ from: "2024-01-01", to: "2024-12-31" }),
    ).not.toThrow();
  });

  it("system prompt includes detailed screen context as JSON", async () => {
    const { systemPrompt } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    const match = systemPrompt.match(/<screen_context>\n([\s\S]*?)\n<\/screen_context>/);
    expect(match?.[1]).toBeTruthy();
    const json = (match?.[1] ?? "")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
    const parsed = JSON.parse(json) as { page?: { label?: string; path?: string } };
    expect(parsed.page?.label).toBe("Query Lab");
    expect(parsed.page?.path).toBe("/discover");
  });
});

describe("buildChatRuntime — ES-dependent tools", () => {
  const fakeConnection = { url: "http://localhost:9200" };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    window.history.pushState({}, "", "/discover");
  });

  it("includes get_cluster_health when connection is provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: fakeConnection,
      pathname: "/discover",
    });
    expect(tools).toHaveProperty("get_cluster_health");
  });

  it("includes get_index_info when connection is provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: fakeConnection,
      pathname: "/discover",
    });
    expect(tools).toHaveProperty("get_index_info");
  });

  it("includes run_raw_es_request when connection is provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: fakeConnection,
      pathname: "/discover",
    });
    expect(tools).toHaveProperty("run_raw_es_request");
  });

  it("includes explain_ingest_pipeline when connection is provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: fakeConnection,
      pathname: "/discover",
    });
    expect(tools).toHaveProperty("explain_ingest_pipeline");
  });

  it("does not include ES-dependent tools when connection is null", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    expect(tools).not.toHaveProperty("get_cluster_health");
    expect(tools).not.toHaveProperty("get_index_info");
    expect(tools).not.toHaveProperty("run_raw_es_request");
    expect(tools).not.toHaveProperty("explain_ingest_pipeline");
    expect(tools).not.toHaveProperty("run_esql_query");
  });
});

describe("buildChatRuntime — generate_esql_query tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    window.history.pushState({}, "", "/discover");
  });

  it("includes generate_esql_query when navigate is provided", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
      navigate,
    });
    expect(tools).toHaveProperty("generate_esql_query");
  });

  it("does not include generate_esql_query when navigate is not provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    expect(tools).not.toHaveProperty("generate_esql_query");
  });

  it("generate_esql_query sets draft query without navigating when navigate_to_query_lab is false", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/traces",
      navigate,
    });
    const genTool = tools.generate_esql_query as {
      execute: (args: { query: string; navigate_to_query_lab?: boolean }) => Promise<unknown>;
    };
    const result = await genTool.execute({
      query: "FROM logs-* | STATS count() BY host.name",
    });
    expect(useQueryStore.getState().discoverQueryDraft).toBe(
      "FROM logs-* | STATS count() BY host.name",
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ set: true, navigatedTo: undefined });
  });

  it("generate_esql_query sets draft and navigates when navigate_to_query_lab is true", async () => {
    const navigate = vi.fn();
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/traces",
      navigate,
    });
    const genTool = tools.generate_esql_query as {
      execute: (args: { query: string; navigate_to_query_lab?: boolean }) => Promise<unknown>;
    };
    const result = await genTool.execute({
      query: "FROM metrics-* | LIMIT 5",
      navigate_to_query_lab: true,
    });
    expect(useQueryStore.getState().discoverQueryDraft).toBe("FROM metrics-* | LIMIT 5");
    expect(navigate).toHaveBeenCalledWith("/discover");
    expect(result).toEqual({ set: true, navigatedTo: "discover" });
  });
});
