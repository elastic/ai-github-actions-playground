import { describe, it, expect, beforeEach, vi } from "vitest";

import { createSplitSecretStorage } from "../../src/store/createSplitSecretStorage";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

interface TestState {
  username: string;
  secret?: string;
}

function makeTestStorage() {
  return createSplitSecretStorage<TestState>({
    restoreSecrets: (_name, state) => ({
      ...state,
      secret: sessionStorage.getItem("test-secret") ?? "",
    }),
    persistSecrets: (_name, state) => {
      sessionStorage.setItem("test-secret", state.secret ?? "");
    },
    stripSecrets: (state) => ({ ...state, secret: "" }),
    clearSecrets: () => {
      sessionStorage.removeItem("test-secret");
    },
  });
}

describe("createSplitSecretStorage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it("getItem returns null when localStorage has no entry", () => {
    const storage = makeTestStorage();
    expect(storage.getItem("my-store")).toBeNull();
  });

  it("getItem returns null and recovers gracefully on malformed JSON", () => {
    localStorageMock.setItem("my-store", "not-valid-json");
    const storage = makeTestStorage();
    expect(storage.getItem("my-store")).toBeNull();
  });

  it("getItem returns null when stored value has no state", () => {
    localStorageMock.setItem("my-store", JSON.stringify({ version: 1 }));
    const storage = makeTestStorage();
    expect(storage.getItem("my-store")).toBeNull();
  });

  it("setItem writes stripped state to localStorage and secrets to sessionStorage", () => {
    const storage = makeTestStorage();
    storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const raw = localStorageMock.getItem("my-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state: TestState };
    expect(parsed.state.secret).toBe("");
    expect(parsed.state.username).toBe("alice");

    expect(sessionStorageMock.getItem("test-secret")).toBe("hunter2");
  });

  it("getItem restores secrets from sessionStorage", () => {
    const storage = makeTestStorage();
    storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    const result = storage.getItem("my-store");
    expect(result).not.toBeNull();
    expect(result!.state.username).toBe("alice");
    expect(result!.state.secret).toBe("hunter2");
  });

  it("getItem restores empty string when session key is absent", () => {
    localStorageMock.setItem(
      "my-store",
      JSON.stringify({ state: { username: "bob", secret: "" }, version: 1 }),
    );
    // sessionStorage has no entry — expect empty string restored
    const storage = makeTestStorage();
    const result = storage.getItem("my-store");
    expect(result!.state.secret).toBe("");
  });

  it("removeItem clears localStorage and sessionStorage", () => {
    const storage = makeTestStorage();
    storage.setItem("my-store", {
      state: { username: "alice", secret: "hunter2" },
      version: 1,
    });

    storage.removeItem("my-store");

    expect(localStorageMock.getItem("my-store")).toBeNull();
    expect(sessionStorageMock.getItem("test-secret")).toBeNull();
  });

  it("removeItem passes the current localStorage raw string to clearSecrets", () => {
    const cleared: Array<string | null> = [];
    const storage = createSplitSecretStorage<TestState>({
      restoreSecrets: (_name, state) => state,
      persistSecrets: () => {},
      stripSecrets: (state) => state,
      clearSecrets: (_name, localRaw) => {
        cleared.push(localRaw);
      },
    });

    storage.setItem("my-store", { state: { username: "x" }, version: 0 });
    storage.removeItem("my-store");

    expect(cleared).toHaveLength(1);
    expect(cleared[0]).not.toBeNull();
  });

  it("removeItem passes null to clearSecrets when localStorage entry is absent", () => {
    const cleared: Array<string | null> = [];
    const storage = createSplitSecretStorage<TestState>({
      restoreSecrets: (_name, state) => state,
      persistSecrets: () => {},
      stripSecrets: (state) => state,
      clearSecrets: (_name, localRaw) => {
        cleared.push(localRaw);
      },
    });

    storage.removeItem("nonexistent");
    expect(cleared[0]).toBeNull();
  });
});
