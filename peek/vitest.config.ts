import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/smoke/**/*.test.{ts,tsx}",
      "tests/component/**/*.test.{ts,tsx}",
    ],
    environment: "jsdom",
    // Pure .ts unit tests default to the lightweight node environment.
    // Files that need jsdom opt in with a `// @vitest-environment jsdom` comment.
    environmentMatchGlobs: [["tests/unit/**/*.test.ts", "node"]],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["scripts/**"],
      thresholds: {
        statements: 35,
        branches: 70,
        functions: 45,
        lines: 35,
      },
    },
  },
  resolve: {
    alias: {
      "echarts/charts": "echarts",
      "echarts/components": "echarts",
      "echarts/renderers": "echarts",
      // Force the ESM build of @perses-dev/components so that CSS font
      // imports use ESM `import` statements (handled by vitest css:false)
      // instead of CJS `require()` which crashes in the Node test environment.
      "@perses-dev/components": "@perses-dev/components/dist/index.js",
    },
  },
});
