/**
 * Session connection slice — active Elasticsearch connection state.
 *
 * Manages the runtime connection (URL + credentials), the `connected` flag,
 * and the fetched user capabilities. This slice is free of profile
 * management or credential-encryption concerns.
 */

import type { StateCreator } from "zustand";

import type { ElasticsearchConnection } from "../types";
import type { UserCapabilities } from "../services/es";

export interface SessionConnectionSlice {
  connection: ElasticsearchConnection | null;
  connected: boolean;
  capabilities: UserCapabilities | null;

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setCapabilities: (caps: UserCapabilities | null) => void;
}

export const createSessionConnectionSlice: StateCreator<
  SessionConnectionSlice,
  [],
  [],
  SessionConnectionSlice
> = (set) => ({
  connection: null,
  connected: false,
  capabilities: null,

  setConnection: (conn) => set({ connection: conn }),
  setConnected: (connected) => set({ connected }),
  setCapabilities: (caps) => set({ capabilities: caps }),
});
