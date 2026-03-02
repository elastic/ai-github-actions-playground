import React from "react";
import ReactDOM from "react-dom/client";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <NuqsAdapter>
          <App />
        </NuqsAdapter>
      </HashRouter>
    </ErrorBoundary>
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
