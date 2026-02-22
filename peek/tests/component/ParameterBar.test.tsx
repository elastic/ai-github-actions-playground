import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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

  it("clears stale ES|QL options when the ES|QL query is cleared", async () => {
    queryMock.mockResolvedValueOnce({ values: [["web"]], executionTimeMs: 1 });
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
        .updateParameter("service", { source: { mode: "esql", query: "   " } });
    });

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("adds a text variable through the dialog", async () => {
    const user = userEvent.setup();
    render(<ParameterBar />);

    await user.click(screen.getByRole("button", { name: /add parameter/i }));
    await screen.findByRole("dialog");

    await user.type(screen.getByLabelText("Name"), "service");
    await user.type(screen.getByLabelText("Label"), "Service");
    await user.type(screen.getByLabelText("Default value"), "web");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useDashboardStore.getState().dashboard.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "service",
            label: "Service",
            value: "web",
            source: { mode: "text" },
          }),
        ]),
      );
    });
    expect(screen.getByText("Service:")).toBeInTheDocument();
  });

  it("renaming a variable to an existing name does not create duplicates", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "text" },
      value: "web",
    });
    useDashboardStore.getState().addParameter({
      name: "env",
      label: "Environment",
      type: "keyword",
      source: { mode: "text" },
      value: "prod",
    });

    render(<ParameterBar />);

    const serviceRow = screen.getByTestId("parameter-row-service");
    const [editButton] = within(serviceRow).getAllByRole("button");
    await user.click(editButton);
    await screen.findByRole("dialog");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "env");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const params = useDashboardStore.getState().dashboard.parameters ?? [];
      expect(params).toHaveLength(1);
      expect(params[0]?.name).toBe("env");
    });
  });
});
