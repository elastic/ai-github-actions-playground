/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct ECharts imports in chart components. Use EChartWrapper or Perses's EChart component instead.",
    },
    schema: [],
    messages: {
      noDirectECharts:
        "Direct ECharts import found. Use EChartWrapper or Perses's EChart component to ensure consistent theming and behavior.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source === "string" && source.startsWith("echarts")) {
          // Allow in EChartWrapper itself and in tests
          const filename = context.getFilename ? context.getFilename() : context.filename;
          if (
            filename.endsWith("EChartWrapper.tsx") ||
            filename.endsWith("PersesEChartWrapper.tsx") ||
            filename.includes("/tests/") ||
            filename.endsWith(".test.ts") ||
            filename.endsWith(".test.tsx")
          ) {
            return;
          }
          context.report({ node, messageId: "noDirectECharts" });
        }
      },
    };
  },
};
