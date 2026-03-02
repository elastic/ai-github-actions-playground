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

  it("keeps latest same-profile switch active despite stale earlier failure", async () => {
    const profileAId = useConnectionStore
      .getState()
      .saveConnectionProfile("A", { url: "(a.example.com/redacted)", apiKey: "a-key" });
    const profileBId = useConnectionStore
      .getState()
      .saveConnectionProfile("B", { url: "(b.example.com/redacted)", apiKey: "b-key" });

    let aAttempt = 0;
    vi.spyOn(esServices, "fetchCapabilitiesForConnection").mockImplementation(
      async (connection) => {
        if (connection.url.includes("a.example.com")) {
          aAttempt += 1;
          const attempt = aAttempt;
          const delayMs = attempt === 1 ? 50 : 20;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (attempt === 1) {
            throw new Error("stale A1 failure");
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return {
          canManageDataStreams: true,
          canCreateApiKeys: true,
          canReadSecurityUsers: true,
          canReadSecurityRoles: true,
          canReadApiKeys: true,
        };
      },
    );

    const switchA1Task = useConnectionStore.getState().switchConnectionProfile(profileAId!);
    const switchBTask = useConnectionStore.getState().switchConnectionProfile(profileBId!);
    const switchA2Task = useConnectionStore.getState().switchConnectionProfile(profileAId!);

    await Promise.all([switchA1Task, switchBTask, switchA2Task]);

    const state = useConnectionStore.getState();
    expect(state.activeProfileId).toBe(profileAId);
    expect(state.profileHealthMap[profileAId!]).toMatchObject({
      status: "healthy",
      errorSummary: null,
    });
  });
});
