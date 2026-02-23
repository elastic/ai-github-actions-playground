import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { migrateLegacyDashboardStore } from "./store/migrateLegacyDashboardStore";

migrateLegacyDashboardStore();

async function bootstrap() {
  const { default: App } = await import("./App");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
