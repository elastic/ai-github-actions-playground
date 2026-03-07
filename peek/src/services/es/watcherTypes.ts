export interface WatcherActionStatus {
  ack?: {
    timestamp?: string | number;
    state?: string;
  };
}

export interface WatcherWatchStatus {
  version?: number;
  state?: {
    active?: boolean;
    timestamp?: string | number;
  };
  execution_state?: string;
  last_checked?: string | number;
  last_met_condition?: string | number;
  actions?: Record<string, WatcherActionStatus>;
}

export interface GetWatchResponse {
  found?: boolean;
  _id?: string;
  _seq_no?: number;
  _primary_term?: number;
  _version?: number;
  status?: WatcherWatchStatus;
  watch?: Record<string, unknown>;
}
