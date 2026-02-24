/**
 * Shared IPC contract types for the Electron main ↔ renderer bridge.
 *
 * Imported by both:
 *   - electron/ipcHandlers.ts  (main process)
 *   - src/electron.d.ts        (renderer-side type declarations)
 *
 * Keep this file free of Node.js or browser-specific imports so that it
 * can be consumed by both compilation contexts.
 */

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
  /** Raw response body as a UTF-8 string.  Parse as JSON when needed. */
  body: string;
  contentType: string;
}
