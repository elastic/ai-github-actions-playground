// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useEsqlQuery } from "../../src/hooks/useEsqlQuery";
import type { ElasticsearchConnection } from "../../src/types";

const mockExecute = vi.fn();

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({ execute: mockExecute }),
}));

const MOCK_CONNECTION: ElasticsearchConnection = {
  url: "http://localhost:9200",
  auth: { type: "none" },
};

describe("useEsqlQuery abort behavior", () => {
  it("clears loading immediately when abort() is called", async () => {
    mockExecute.mockImplementationOnce((_request: unknown, signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
      });
    });

    const { result } = renderHook(() =>
      useEsqlQuery({
        connection: MOCK_CONNECTION,
        onSuccess: () => {},
      }),
    );

    act(() => {
      void result.current.runQuery("FROM traces-* | LIMIT 10");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    act(() => {
      result.current.abort();
    });

    expect(result.current.loading).toBe(false);
  });
});
