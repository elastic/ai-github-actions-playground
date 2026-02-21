import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/ai-github-actions-playground/",
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // When ES_URL is set, proxy /_query to Elasticsearch to avoid CORS.
    // Example: ES_URL=http://localhost:9200 npm run dev
    // Then connect the dashboard to http://localhost:3000 (no path).
    proxy: process.env.ES_URL
      ? {
          "/_query": {
            target: process.env.ES_URL,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
