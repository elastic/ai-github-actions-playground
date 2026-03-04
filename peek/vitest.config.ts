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
        // Branch coverage is set higher because branch-level checks are the
        // most effective metric for detecting untested conditional logic.
        // Statement/line/function thresholds are intentionally lower: the
        // codebase is UI-heavy and many React components are exercised through
        // integration & E2E tests rather than unit tests, so raw line
        // coverage under-reports actual test effectiveness.
        statements: 35,
        branches: 70,
        functions: 45,
        lines: 35,
      },
    },
  },
  resolve: {
    alias: [
      { find: "echarts/charts", replacement: "echarts" },
      { find: "echarts/components", replacement: "echarts" },
      { find: "echarts/renderers", replacement: "echarts" },
      // Force the ESM build of @perses-dev/components so that CSS font
      // imports use ESM `import` statements (handled by vitest css:false)
      // instead of CJS `require()` which crashes in the Node test environment.
      // Regex enforces exact match only (not subpath imports).
      {
        find: /^@perses-dev\/components$/,
        replacement: "@perses-dev/components/dist/index.js",
      },
      {
        find: /^@perses-dev\/plugin-system$/,
        replacement: "@perses-dev/plugin-system/dist/index.js",
      },
    ],
  },
});
