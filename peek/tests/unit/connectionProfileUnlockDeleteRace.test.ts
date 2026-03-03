import { beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectionStore } from "../../src/store/useConnectionStore";
import {
  CONNECTION_STORE_NAME,
  PROFILE_SESSION_PREFIX,
  ENCRYPTED_STORE_SUFFIX,
} from "../../src/store/connectionStorageAdapters";
import * as cryptoUtils from "../../src/utils/crypto";

describe("connection profile unlock/delete race", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    useConnectionStore.getState().resetConnectionState();
  });

  it("returns false when profile is deleted while unlock is in flight", async () => {
    // Control when decryptWithPin resolves so we can delete in between.
    let resolveDecrypt!: (value: string | null) => void;
    const decryptPromise = new Promise<string | null>((resolve) => {
      resolveDecrypt = resolve;
    });

    vi.spyOn(cryptoUtils, "decryptWithPin").mockReturnValue(decryptPromise);

    const id = useConnectionStore
      .getState()
      .saveConnectionProfile("Race", { url: "https://test.example.com", apiKey: "" });
    expect(id).toBeTruthy();

    // Plant an encrypted payload so unlockProfile finds something to decrypt.
    const encryptedKey =
      CONNECTION_STORE_NAME + PROFILE_SESSION_PREFIX + id + ENCRYPTED_STORE_SUFFIX;
    localStorage.setItem(encryptedKey, JSON.stringify({ salt: "s", iv: "i", data: "d" }));

    // Start unlocking — will pause at the mocked decryptWithPin.
    const unlockTask = useConnectionStore.getState().unlockProfile(id!, "1234");

    // While decryption is in-flight, delete the profile.
    useConnectionStore.getState().deleteConnectionProfile(id!);
    expect(useConnectionStore.getState().connectionProfiles).toHaveLength(0);

    // Now let decryption finish with valid credentials.
    resolveDecrypt(JSON.stringify({ apiKey: "new-key", password: "pw", otlpApiKey: "otlp" }));

    // unlockProfile must return false because the profile no longer exists.
    await expect(unlockTask).resolves.toBe(false);
  });
});
