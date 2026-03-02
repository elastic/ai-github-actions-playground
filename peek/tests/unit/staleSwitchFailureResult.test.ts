import { beforeEach, describe, expect, it, vi } from "vitest";

import * as esServices from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";

describe("stale switch failure result", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useConnectionStore.getState().resetConnectionState();
    vi.restoreAllMocks();
  });

  it("does not report stale switch failure as a real failure", async () => {
    const profileAId = useConnectionStore
      .getState()
      .saveConnectionProfile("A", { url: "https://a.example.com", apiKey: "a-key" });
    const profileBId = useConnectionStore
      .getState()
      .saveConnectionProfile("B", { url: "https://b.example.com", apiKey: "b-key" });
    expect(profileAId).toBeTruthy();
    expect(profileBId).toBeTruthy();

    type Capabilities = Awaited<ReturnType<typeof esServices.fetchCapabilitiesForConnection>>;
    const caps: Capabilities = {
      canManageDataStreams: true,
      canCreateApiKeys: true,
      canReadSecurityUsers: true,
      canReadSecurityRoles: true,
      canReadApiKeys: true,
    };

    let rejectA!: (reason?: unknown) => void;
    let resolveB!: (value: Capabilities) => void;

    vi.spyOn(esServices, "fetchCapabilitiesForConnection")
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((_resolve, reject) => {
            rejectA = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Capabilities>((resolve) => {
            resolveB = resolve;
          }),
      );

    const firstSwitch = useConnectionStore.getState().switchConnectionProfile(profileAId!);
    const secondSwitch = useConnectionStore.getState().switchConnectionProfile(profileBId!);

    resolveB(caps);
    const secondResult = await secondSwitch;
    expect(secondResult.ok).toBe(true);

    rejectA(new Error("stale switch failure"));
    const firstResult = await firstSwitch;

    expect(useConnectionStore.getState().activeProfileId).toBe(profileBId);
    expect(firstResult.ok).toBe(true);
  });
});
