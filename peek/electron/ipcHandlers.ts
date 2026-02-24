import fs from "fs";
import path from "path";

import { app, ipcMain, net, safeStorage } from "electron";

// ---------------------------------------------------------------------------
// Types shared between main process and renderer (via preload)
// ---------------------------------------------------------------------------

export interface ESFetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface ESFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
  contentType: string;
}

// ---------------------------------------------------------------------------
// ES HTTP transport — uses Electron's net module (no CORS restrictions)
// ---------------------------------------------------------------------------

function fetchViaNet(req: ESFetchRequest): Promise<ESFetchResponse> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url: req.url,
      method: req.method ?? "GET",
    });

    for (const [key, value] of Object.entries(req.headers ?? {})) {
      request.setHeader(key, value);
    }

    if (req.timeoutMs) {
      setTimeout(() => {
        request.abort();
        reject(new Error("Request timed out"));
      }, req.timeoutMs);
    }

    const chunks: Buffer[] = [];

    request.on("response", (response) => {
      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const status = response.statusCode;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: response.statusMessage ?? "",
          body,
          contentType: String(response.headers["content-type"] ?? ""),
        });
      });

      response.on("error", (err: Error) => reject(err));
    });

    request.on("error", (err: Error) => reject(err));

    if (req.body) {
      request.write(req.body);
    }

    request.end();
  });
}

// ---------------------------------------------------------------------------
// Credential storage — safeStorage (OS keychain) + userData JSON file
// ---------------------------------------------------------------------------

function getCredentialStorePath(): string {
  return path.join(app.getPath("userData"), "credentials-safe.json");
}

function readCredentialStore(): Record<string, string> {
  try {
    const raw = fs.readFileSync(getCredentialStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCredentialStore(store: Record<string, string>): void {
  const filePath = getCredentialStorePath();
  fs.writeFileSync(filePath, JSON.stringify(store));
  // Restrict to owner-only after writing (best-effort; no-op on Windows)
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // chmod is not supported on all platforms (e.g. Windows); ignore silently
  }
}

function encryptCredential(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    // Log a warning so the developer knows credentials will not be encrypted.
    // This can happen on Linux systems without a keychain (e.g. headless CI).
    console.warn(
      "[Elastic Peek] safeStorage encryption is unavailable on this platform. " +
        "Credentials will be stored without encryption.",
    );
    return value;
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decryptCredential(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) return encrypted;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------

export function registerIpcHandlers(): void {
  // ES HTTP transport — routes requests through the main process to bypass CORS
  ipcMain.handle("es:fetch", (_event, req: ESFetchRequest): Promise<ESFetchResponse> => {
    return fetchViaNet(req);
  });

  // Credential persistence via OS keychain (safeStorage)
  ipcMain.handle("credentials:store", (_event, key: string, value: string): void => {
    const store = readCredentialStore();
    store[key] = encryptCredential(value);
    writeCredentialStore(store);
  });

  ipcMain.handle("credentials:retrieve", (_event, key: string): string => {
    const store = readCredentialStore();
    const encrypted = store[key];
    if (encrypted === undefined) return "";
    return decryptCredential(encrypted);
  });

  ipcMain.handle("credentials:delete", (_event, key: string): void => {
    const store = readCredentialStore();
    delete store[key];
    writeCredentialStore(store);
  });
}
