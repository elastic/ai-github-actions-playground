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
          // Allow type-only imports (no runtime effect)
          const declarationTypeOnly = node.importKind === "type";
          const specifiersTypeOnly =
            node.specifiers.length > 0 &&
            node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type");
          if (declarationTypeOnly || specifiersTypeOnly) {
            return;
          }
          // Allow in EChartWrapper itself and in tests
          const filename = context.getFilename ? context.getFilename() : context.filename;
          const normalizedFilename = filename.replace(/\\/g, "/");
          if (
            normalizedFilename.endsWith("EChartWrapper.tsx") ||
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
