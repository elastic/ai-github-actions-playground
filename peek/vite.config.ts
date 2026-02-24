import path from "path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

import { rewriteEsProxyPath } from "./src/utils/rewriteEsProxyPath";

export default defineConfig(({ mode }) => {
  // Load env vars from the repo root (.env) and peek/ directory so ES_URL
  // can be set in either location without requiring a shell export.
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, import.meta.dirname, ""),
    ...process.env,
  };

  const esUrl = env.ES_URL;
  // ELECTRON=true switches to the Electron target:
  //   - base becomes './' so assets load under the file:// protocol
  //   - vite-plugin-electron compiles main/preload and launches Electron in dev
  const isElectron = Boolean(env.ELECTRON);

  return {
    base: isElectron ? "./" : (env.VITE_BASE_PATH ?? "/ai-github-actions-playground/"),
    plugins: [
      react(),
      // Only active when ELECTRON=true — keeps the web build unaffected
      ...(isElectron
        ? [
            electron({
              main: {
                // Electron main process entry point
                entry: "electron/main.ts",
              },
              preload: {
                // Preload script that exposes the IPC bridge to the renderer
                input: path.join(import.meta.dirname, "electron/preload.ts"),
              },
            }),
          ]
        : []),
    ],
    server: {
      port: 3000,
      open: !isElectron, // Electron plugin opens the app; skip browser auto-open
      // When ES_URL is set, proxy /_es requests to Elasticsearch to avoid CORS.
      //
      // /_es     — full proxy for all Elasticsearch APIs (connection validation,
      //            cluster health, data streams, field caps, API console, etc.).
      //            Use http://localhost:3000/_es as the Elasticsearch URL.
      //
      // Example: ES_URL=http://localhost:9200 npm run dev
      //     or: add ES_URL=http://localhost:9200 to .env at the repo root
      proxy: esUrl
        ? {
            "/_es": {
              target: esUrl,
              changeOrigin: true,
              secure: false,
              rewrite: rewriteEsProxyPath,
            },
          }
        : undefined,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
