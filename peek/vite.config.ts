import path from "path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

import { rewriteEsProxyPath } from "./src/utils/rewriteEsProxyPath";

function sanitizeProxyHostHeader(target: string): string | null {
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  // Load env vars from the repo root (.env) and peek/ directory.
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, import.meta.dirname, ""),
    ...process.env,
  };

  // ELECTRON=true switches to the Electron target:
  //   - base becomes './' so assets load under the file:// protocol
  //   - vite-plugin-electron compiles main/preload and launches Electron in dev
  const isElectron = Boolean(env.ELECTRON);

  return {
    base: isElectron ? "./" : (env.VITE_BASE_PATH ?? "/ai-github-actions-playground/"),
    resolve: {
      alias: {
        // @perses-dev/explore and @perses-dev/dashboards are not installed.
        // They are referenced only by lazy require() calls inside
        // @perses-dev/plugin-system/PluginRuntime, which Peek does not use.
        // These stubs satisfy the import without pulling in the actual packages.
        "@perses-dev/explore": path.resolve(
          import.meta.dirname,
          "src/stubs/perses-explore-stub.ts",
        ),
        "@perses-dev/dashboards": path.resolve(
          import.meta.dirname,
          "src/stubs/perses-dashboards-stub.ts",
        ),
      },
    },
    plugins: [
      react(),
      // Only active when ELECTRON=true — keeps the web build unaffected
      ...(isElectron
        ? [
            electron({
              main: {
                // Electron main process entry point
                entry: "electron/main.ts",
                onstart(args) {
                  // IDEs like Cursor/VS Code set ELECTRON_RUN_AS_NODE=1 which
                  // causes Electron to run as plain Node.js instead of as a
                  // browser process. Remove it before spawning the Electron app.
                  delete process.env.ELECTRON_RUN_AS_NODE;
                  args.startup();
                },
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
      // Proxy /_es requests to Elasticsearch to avoid CORS.
      // The target is determined per-request from the X-Elastic-Peek-Proxy-Host
      // header that the client sends with every request.
      //
      // Use http://localhost:3000/_es as the Elasticsearch URL in the UI.
      proxy: {
        "/_es": {
          // Required by Vite; real routing is provided by `router`.
          target: "http://localhost:9200",
          changeOrigin: true,
          secure: false,
          rewrite: rewriteEsProxyPath,
          router: (req) => {
            const host = req.headers["x-elastic-peek-proxy-host"];
            if (typeof host === "string" && host) {
              const sanitized = sanitizeProxyHostHeader(host);
              if (sanitized) return sanitized;
            }
            return "http://localhost:9200";
          },
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            echarts: ["echarts/core", "echarts/charts", "echarts/components", "echarts/renderers"],
            mui: ["@mui/material", "@mui/icons-material"],
            codemirror: [
              "@uiw/react-codemirror",
              "@codemirror/lang-sql",
              "@lezer/lr",
              "@lezer/common",
              "@lezer/highlight",
            ],
            perses: ["@perses-dev/components", "@perses-dev/core"],
            "ai-sdk": ["ai", "@ai-sdk/openai"],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        "echarts",
        "@perses-dev/components",
        "@perses-dev/core",
        "@perses-dev/plugin-system",
      ],
      exclude: [],
    },
  };
});
