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

  it("does not include navigate_to_page when navigate is not provided", async () => {
    const { tools } = await buildChatRuntime({
      config: defaultConfig,
      connection: null,
      pathname: "/discover",
    });
    expect(tools).not.toHaveProperty("navigate_to_page");
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
});
