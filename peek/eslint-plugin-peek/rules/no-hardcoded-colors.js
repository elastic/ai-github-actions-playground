/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow hardcoded hex, rgb(), or rgba() colors in sx props, style objects, and ECharts option builders. Use theme tokens instead.",
    },
    schema: [],
    messages: {
      noHardcodedColor:
        "Hardcoded color '{{value}}' found. Reference a theme token instead (e.g. 'primary.main', 'text.secondary').",
    },
  },
  create(context) {
    const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/;
    const RGB_RE = /rgba?\(.*?\)/;

    function isColorLiteral(node) {
      return (
        node.type === "Literal" &&
        typeof node.value === "string" &&
        (HEX_RE.test(node.value) || RGB_RE.test(node.value))
      );
    }

    function isTemplateLiteralWithColor(node) {
      if (node.type !== "TemplateLiteral") return false;
      return node.quasis.some((q) => HEX_RE.test(q.value.raw) || RGB_RE.test(q.value.raw));
    }

    /** Check whether a node sits inside an `sx` prop or a `style` prop. */
    function isInsideSxOrStyle(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === "JSXAttribute" &&
          current.name &&
          (current.name.name === "sx" || current.name.name === "style")
        ) {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /** Check whether the file is an ECharts option builder (heuristic: file imports echarts). */
    function checkIsEChartsFile() {
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const ast = sourceCode.ast;
      return ast.body.some(
        (node) =>
          node.type === "ImportDeclaration" &&
          typeof node.source.value === "string" &&
          node.source.value.startsWith("echarts"),
      );
    }

    const fileIsECharts = checkIsEChartsFile();

    function report(node) {
      const value =
        node.type === "Literal"
          ? node.value
          : node.quasis.map((q) => q.value.raw).join("${expression}");
      context.report({ node, messageId: "noHardcodedColor", data: { value } });
    }

    return {
      Literal(node) {
        if (!isColorLiteral(node)) return;
        if (fileIsECharts || isInsideSxOrStyle(node)) {
          report(node);
        }
      },
      TemplateLiteral(node) {
        if (!isTemplateLiteralWithColor(node)) return;
        if (fileIsECharts || isInsideSxOrStyle(node)) {
          report(node);
        }
      },
    };
  },
};
