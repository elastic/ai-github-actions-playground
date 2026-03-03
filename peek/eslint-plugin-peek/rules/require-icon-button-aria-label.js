/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require aria-label on IconButton components for accessibility. Tooltips alone are not sufficient for screen readers.",
    },
    schema: [],
    messages: {
      missingAriaLabel:
        "IconButton is missing an aria-label attribute. Add aria-label for screen reader accessibility.",
    },
  },
  create(context) {
    const localNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "@mui/material/IconButton") return;
        for (const specifier of node.specifiers) {
          localNames.add(specifier.local.name);
        }
      },
      JSXOpeningElement(node) {
        const name = node.name;
        if (name.type !== "JSXIdentifier" || !localNames.has(name.name)) return;

        const hasAriaLabel = node.attributes.some((attr) => {
          if (attr.type !== "JSXAttribute" || attr.name.name !== "aria-label") return false;
          const val = attr.value;
          // aria-label={undefined} or aria-label={null} — no value node
          if (val === null || val === undefined) return false;
          // aria-label="" — empty string literal
          if (val.type === "Literal")
            return typeof val.value === "string" && val.value.trim() !== "";
          // aria-label={expr}
          if (val.type === "JSXExpressionContainer") {
            const expr = val.expression;
            // aria-label={undefined}
            if (expr.type === "Identifier" && expr.name === "undefined") return false;
            // aria-label={null}
            if (expr.type === "Literal" && expr.value === null) return false;
            // aria-label={""}
            if (
              expr.type === "Literal" &&
              typeof expr.value === "string" &&
              expr.value.trim() === ""
            )
              return false;
            // any other expression (variable, template literal, etc.) — conservatively accept
            return true;
          }
          return true;
        });

        if (!hasAriaLabel) {
          context.report({ node, messageId: "missingAriaLabel" });
        }
      },
    };
  },
};
