import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/ai-github-actions-playground/",
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
    //            Connect the dashboard to http://localhost:3000/_es
    //
    // Example: ES_URL=http://localhost:9200 npm run dev
    proxy: process.env.ES_URL
      ? {
          "/_query": {
            target: process.env.ES_URL,
            changeOrigin: true,
          },
          "/_es": {
            target: process.env.ES_URL,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/_es/, ""),
          },
        }
      : undefined,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
