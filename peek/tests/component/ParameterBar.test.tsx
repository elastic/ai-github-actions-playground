import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParameterBar from "../../src/components/ParameterBar";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: queryMock,
  })),
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("ParameterBar", () => {
  beforeEach(() => {
    queryMock.mockReset();
    useDashboardStore.getState().resetState();
    useDashboardStore.getState().setConnected(true);
    useDashboardStore.getState().setConnection({ url: "https://localhost:9200", apiKey: "test-key" });
  });

  it("clears stale ES|QL options after a failed refresh", async () => {
    queryMock
      .mockResolvedValueOnce({ values: [["web"]], executionTimeMs: 1 })
      .mockRejectedValueOnce(new Error("query failed"));
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "esql", query: "FROM logs-* | LIMIT 1" },
      value: "",
    });

    render(<ParameterBar />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    act(() => {
      useDashboardStore
        .getState()
        .updateParameter("service", { source: { mode: "esql", query: "FROM bad query" } });
    });

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
