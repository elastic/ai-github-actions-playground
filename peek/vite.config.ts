import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

  return {
    base: env.VITE_BASE_PATH ?? "/ai-github-actions-playground/",
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      // When ES_URL is set, proxy /_query and /_es requests to Elasticsearch
      // to avoid CORS.
      //
      // /_query  — backwards-compatible proxy for ES|QL queries.
      // /_es     — full proxy for all Elasticsearch APIs (connection validation,
      //            cluster health, data streams, field caps, API console, etc.).
      //            Use http://localhost:3000/_es as the Elasticsearch URL.
      //
      // Example: ES_URL=http://localhost:9200 npm run dev
      //     or: add ES_URL=http://localhost:9200 to .env at the repo root
      proxy: esUrl
        ? {
            "/_query": {
              target: esUrl,
              changeOrigin: true,
            },
            "/_es": {
              target: esUrl,
              changeOrigin: true,
              rewrite: (p: string) => p.replace(/^\/_es/, ""),
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
