import { beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectionStore } from "../../src/store/useConnectionStore";
import {
  CONNECTION_STORE_NAME,
  PROFILE_SESSION_PREFIX,
  ENCRYPTED_STORE_SUFFIX,
} from "../../src/store/connectionStorageAdapters";
import * as cryptoUtils from "../../src/utils/crypto";

describe("connection profile lock/delete race", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    useConnectionStore.getState().resetConnectionState();
  });

  it("should not re-create encrypted payload after a profile is deleted", async () => {
    // Control when encryptWithPin resolves so we can delete in between.
    let resolveEncrypt!: (value: cryptoUtils.EncryptedPayload) => void;
    const encryptPromise = new Promise<cryptoUtils.EncryptedPayload>((resolve) => {
      resolveEncrypt = resolve;
    });

    vi.spyOn(cryptoUtils, "encryptWithPin").mockReturnValue(encryptPromise);

    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Test", { url: "https://test.example.com", apiKey: "secret-key" });
    expect(id).toBeTruthy();

    // Start locking — will pause at the mocked encryptWithPin.
    const lockDone = useConnectionStore.getState().lockProfile(id!, "1234");

    // While encryption is in-flight, delete the profile.
    useConnectionStore.getState().deleteConnectionProfile(id!);
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);

    // Now let encryption finish.
    resolveEncrypt({ salt: "s", iv: "i", data: "d" });
    await lockDone;

    // The encrypted payload must NOT have been written back.
    const encKey = CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX;
    expect(localStorage.getItem(encKey)).toBeNull();
  });
});
