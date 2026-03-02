import { beforeEach, describe, expect, it, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("repro: switchConnectionProfile race", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("keeps last requested profile active when switches overlap", async () => {
    const profileAId = useConnectionStore
      .getState()
      .saveConnectionProfile("A", { url: "(a.example.com/redacted)", apiKey: "a-key" });
    const profileBId = useConnectionStore
      .getState()
      .saveConnectionProfile("B", { url: "(b.example.com/redacted)", apiKey: "b-key" });

    vi.spyOn(esServices, "fetchCapabilitiesForConnection").mockImplementation(
      async (connection) => {
        const delayMs = connection.url.includes("a.example.com") ? 50 : 10;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return {
          canManageDataStreams: true,
          canCreateApiKeys: true,
          canReadSecurityUsers: true,
          canReadSecurityRoles: true,
          canReadApiKeys: true,
        };
      },
    );

    const switchATask = useConnectionStore.getState().switchConnectionProfile(profileAId!);
    const switchBTask = useConnectionStore.getState().switchConnectionProfile(profileBId!);

    await Promise.all([switchATask, switchBTask]);

    expect(useConnectionStore.getState().activeProfileId).toBe(profileBId);
  });
});
