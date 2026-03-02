import { beforeEach, describe, expect, it, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("stale retest failure result", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("does not report stale retest failure as a real failure", async () => {
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

    resolveSecond(caps);
    const secondResult = await secondRetest;
    expect(secondResult.ok).toBe(true);

    rejectFirst(new Error("stale failure"));
    const firstResult = await firstRetest;

    // Stale failure must not be reported as a real failure to callers
    expect(firstResult.ok).toBe(true);
  });
});
