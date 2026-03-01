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
    const HEX_RE = /^#(?:[0-9a-fA-F]{3,8})$/;
    const RGB_RE = /^rgba?\(/;

    function isColorLiteral(node) {
      return (
        node.type === "Literal" &&
        typeof node.value === "string" &&
        (HEX_RE.test(node.value) || RGB_RE.test(node.value))
      );
    }

    function isTemplateLiteralWithColor(node) {
      if (node.type !== "TemplateLiteral") return false;
      return node.quasis.some(
        (q) => HEX_RE.test(q.value.raw.trim()) || RGB_RE.test(q.value.raw.trim()),
      );
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
    function isEChartsFile() {
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const ast = sourceCode.ast;
      return ast.body.some(
        (node) =>
          node.type === "ImportDeclaration" &&
          typeof node.source.value === "string" &&
          node.source.value.startsWith("echarts"),
      );
    }

    function report(node) {
      const value = node.type === "Literal" ? node.value : "<template literal>";
      context.report({ node, messageId: "noHardcodedColor", data: { value } });
    }

    return {
      Literal(node) {
        if (!isColorLiteral(node)) return;
        if (isInsideSxOrStyle(node) || isEChartsFile()) {
          report(node);
        }
      },
      TemplateLiteral(node) {
        if (!isTemplateLiteralWithColor(node)) return;
        if (isInsideSxOrStyle(node) || isEChartsFile()) {
          report(node);
        }
      },
    };
  },
};
