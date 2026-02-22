import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/smoke/**/*.test.{ts,tsx}",
      "tests/component/**/*.test.{ts,tsx}",
    ],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
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
    },
  },
});
