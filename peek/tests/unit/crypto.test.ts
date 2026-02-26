import { describe, it, expect } from "vitest";

import { encryptWithPin, decryptWithPin } from "../../src/utils/crypto";
import type { EncryptedPayload } from "../../src/utils/crypto";

describe("crypto utilities", () => {
  it("encryptWithPin produces a payload with salt, iv, and data fields", async () => {
    const payload = await encryptWithPin("my-pin", "hello");
    expect(typeof payload.salt).toBe("string");
    expect(typeof payload.iv).toBe("string");
    expect(typeof payload.data).toBe("string");
    expect(payload.salt.length).toBeGreaterThan(0);
    expect(payload.iv.length).toBeGreaterThan(0);
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("encryptWithPin produces different ciphertext on each call (random IV/salt)", async () => {
    const a = await encryptWithPin("pin", "same plaintext");
    const b = await encryptWithPin("pin", "same plaintext");
    expect(a.data).not.toBe(b.data);
  });

  it("decryptWithPin recovers the original plaintext", async () => {
    const plaintext = "super secret api key";
    const payload = await encryptWithPin("1234", plaintext);
    const recovered = await decryptWithPin("1234", payload);
    expect(recovered).toBe(plaintext);
  });

  it("decryptWithPin returns null for wrong PIN", async () => {
    const payload = await encryptWithPin("correct-pin", "secret");
    const result = await decryptWithPin("wrong-pin", payload);
    expect(result).toBeNull();
  });

  it("decryptWithPin returns null for corrupted data", async () => {
    const payload = await encryptWithPin("pin", "secret");
    const corrupted: EncryptedPayload = { ...payload, data: "AAAA" };
    const result = await decryptWithPin("pin", corrupted);
    expect(result).toBeNull();
  });

  it("decryptWithPin handles JSON-serialized credentials round-trip", async () => {
    const creds = { apiKey: "abc123", password: "" };
    const payload = await encryptWithPin("mysecretpin", JSON.stringify(creds));
    const recovered = await decryptWithPin("mysecretpin", payload);
    expect(recovered).not.toBeNull();
    expect(JSON.parse(recovered!)).toEqual(creds);
  });
});
