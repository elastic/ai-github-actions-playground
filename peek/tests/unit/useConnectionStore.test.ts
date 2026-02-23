import { describe, it, expect, beforeEach, vi } from "vitest";

import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

describe("useConnectionStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useConnectionStore.getState().resetConnectionState();
  });

  it("saveConnectionProfile and deleteConnectionProfile work", () => {
    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Dev", { url: "https://dev.example.com", apiKey: "dev-key" });

    expect(id).toBeTruthy();
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(1);

    useConnectionStore.getState().deleteConnectionProfile(id!);

    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);
  });

  it("resetConnectionState clears connection and profiles", () => {
    useConnectionStore.setState({
      connection: { url: "https://example.com", apiKey: "key" },
      connected: true,
    });
    useConnectionStore
      .getState()
      .saveConnectionProfile("Prod", { url: "https://prod.example.com", apiKey: "prod-key" });

    useConnectionStore.getState().resetConnectionState();

    const state = useConnectionStore.getState();
    expect(state.connection).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.connectionProfiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
  });
});
