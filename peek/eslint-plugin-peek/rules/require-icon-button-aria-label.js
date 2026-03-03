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

        const hasAriaLabel = node.attributes.some(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "aria-label",
        );

        if (!hasAriaLabel) {
          context.report({ node, messageId: "missingAriaLabel" });
        }
      },
    };
  },
};
