import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Exclude agent worktrees so nested project copies don't pollute test runs.
    exclude: ["**/.claude/**", "**/.copilot/**", "**/node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit-node",
          // Pure .ts unit tests use the lightweight node environment.
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          // happy-dom is 2-5x faster than jsdom for DOM operations.
          include: [
            "tests/unit/**/*.test.tsx",
            "tests/smoke/**/*.test.{ts,tsx}",
            "tests/component/**/*.test.{ts,tsx}",
          ],
          environment: "happy-dom",
        },
      },
    ],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
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
