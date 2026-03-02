import { beforeEach, describe, expect, it, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("repro: switch/retest cross-action race", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("keeps profile healthy when retest succeeds after an earlier switch request", async () => {
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

    let rejectSwitch!: (reason?: unknown) => void;
    let resolveRetest!: (value: Capabilities) => void;

    vi.spyOn(esServices, "fetchCapabilitiesForConnection")
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((_resolve, reject) => {
            rejectSwitch = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((resolve) => {
            resolveRetest = resolve;
          }),
      );

    const switchTask = useConnectionStore.getState().switchConnectionProfile(profileId!);
    const retestTask = useConnectionStore.getState().retestConnectionProfile(profileId!);

    resolveRetest(caps);
    const retestResult = await retestTask;
    expect(retestResult.ok).toBe(true);
    expect(useConnectionStore.getState().profileHealthMap[profileId!]?.status).toBe("healthy");

    rejectSwitch(new Error("stale switch failure"));
    await switchTask;

    expect(useConnectionStore.getState().profileHealthMap[profileId!]?.status).toBe("healthy");
  });
});
