/**
 * PIN-based encryption utilities using the Web Crypto API.
 *
 * Key derivation: PBKDF2 (SHA-256, 600 000 iterations) → AES-GCM-256.
 * Each encrypted payload includes a random salt and IV so the same PIN
 * always produces different ciphertext.
 */

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = "SHA-256";
const KEY_ALGO = "AES-GCM";
const KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedPayload {
  salt: string;
  iv: string;
  data: string;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// The explicit Uint8Array<ArrayBuffer> annotation is intentional: TypeScript 5.x
// infers Uint8Array.from() as Uint8Array<ArrayBufferLike>, which does not satisfy
// the BufferSource constraint required by the Web Crypto API (BufferSource requires
// ArrayBufferView<ArrayBuffer>). The loop-based constructor and explicit return type
// ensure the backing store is a plain ArrayBuffer.
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    { name: KEY_ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a plaintext string with a PIN. Returns a JSON-serializable payload. */
export async function encryptWithPin(pin: string, plaintext: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(pin, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: KEY_ALGO, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt a payload encrypted with {@link encryptWithPin}.
 * Returns the original plaintext, or `null` if the PIN is wrong or the payload
 * is corrupt.
 */
export async function decryptWithPin(
  pin: string,
  payload: EncryptedPayload,
): Promise<string | null> {
  try {
    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.data);
    const key = await deriveKey(pin, salt);
    const plaintext = await crypto.subtle.decrypt({ name: KEY_ALGO, iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
