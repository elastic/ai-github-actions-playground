/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct ECharts imports in app code. Use Perses panel abstractions instead.",
    },
    schema: [],
    messages: {
      noDirectECharts:
        "Direct ECharts import found. Use Perses's EChart component to ensure consistent theming and behavior.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source === "string" && source.startsWith("echarts")) {
          // Allow type-only imports — they are erased at compile time and
          // do not affect runtime theming or behavior.
          if (node.importKind === "type") return;

          // Allow only explicit adapter escape hatch and tests.
          const filename = context.getFilename ? context.getFilename() : context.filename;
          const normalizedFilename = filename.replace(/\\/g, "/");
          if (
            normalizedFilename.endsWith("PersesEChartWrapper.tsx") ||
            normalizedFilename.includes("/tests/") ||
            normalizedFilename.endsWith(".test.ts") ||
            normalizedFilename.endsWith(".test.tsx")
          ) {
            return;
          }
          context.report({ node, messageId: "noDirectECharts" });
        }
      },
    };
  },
};
