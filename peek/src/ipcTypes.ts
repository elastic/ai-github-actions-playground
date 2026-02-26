/**
 * Shared IPC request/response types used by both the Electron main process
 * (`electron/ipcHandlers.ts`) and the renderer-side type declarations
 * (`electron.d.ts`).  Keeping them in one place prevents schema drift
 * between the two sides of the IPC bridge.
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
