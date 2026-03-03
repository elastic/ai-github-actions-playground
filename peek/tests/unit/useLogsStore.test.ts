// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { useLogsStore } from "../../src/store/useLogsStore";

describe("useLogsStore", () => {
  beforeEach(() => {
    useLogsStore.getState().reset();
  });

  it("deduplicates identical filters", () => {
    useLogsStore.getState().addFilter({ field: "service.name", value: "checkout" });
    useLogsStore.getState().addFilter({ field: "service.name", value: "checkout" });
    expect(useLogsStore.getState().filters).toHaveLength(1);
  });

  it("clears raw query when search text changes", () => {
    useLogsStore.getState().setRawQuery("FROM logs-* | LIMIT 1");
    useLogsStore.getState().setSearchText("error");
    expect(useLogsStore.getState().rawQuery).toBeNull();
  });
});
