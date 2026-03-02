import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { useConnectionStore } from "./store/useConnectionStore";
import {
  getTracingConnectionSnapshot,
  shouldReconfigureTracing,
  syncBrowserTracingForConnection,
} from "./services/telemetry/browserTracing";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <HashRouter>
          <NuqsAdapter>
            <App />
          </NuqsAdapter>
        </HashRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);

const initialState = useConnectionStore.getState();
void syncBrowserTracingForConnection(initialState.connection, initialState.connected);

useConnectionStore.subscribe((state, previous) => {
  const currentSnapshot = getTracingConnectionSnapshot(state.connection, state.connected);
  const previousSnapshot = getTracingConnectionSnapshot(previous.connection, previous.connected);
  if (!shouldReconfigureTracing(previousSnapshot, currentSnapshot)) {
    return;
  }
  void syncBrowserTracingForConnection(state.connection, state.connected);
});
