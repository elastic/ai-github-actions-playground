import { beforeEach, describe, expect, it, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("retestConnectionProfile race", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("keeps latest successful retest result when two retests overlap", async () => {
    const profileId = useConnectionStore
      .getState()
      .saveConnectionProfile("A", { url: "https://a.example.com", apiKey: "a-key" });
    expect(profileId).toBeTruthy();

    type Capabilities = Awaited<ReturnType<typeof esServices.fetchCapabilitiesForConnection>>;
    const caps: Capabilities = {
      canManageDataStreams: true,
      canCreateApiKeys: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
      canReadApiKeys: true,
      canReadIngestPipelines: true,
    };

    let rejectFirst!: (reason?: unknown) => void;
    let resolveSecond!: (value: Capabilities) => void;

    vi.spyOn(esServices, "fetchCapabilitiesForConnection")
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const firstRetest = useConnectionStore.getState().retestConnectionProfile(profileId!);
    const secondRetest = useConnectionStore.getState().retestConnectionProfile(profileId!);

    // Second (newer) retest succeeds first.
    resolveSecond(caps);
    await secondRetest;
    expect(useConnectionStore.getState().profileHealthMap[profileId!]?.status).toBe("healthy");

    // First (stale) retest fails after.
    rejectFirst(new Error("stale failure"));
    await firstRetest;

    // The stale failure must NOT overwrite the newer healthy status.
    expect(useConnectionStore.getState().profileHealthMap[profileId!]?.status).toBe("healthy");
  });
});
