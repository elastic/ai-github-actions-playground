/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Components that branch on empty data (.length === 0, !data, etc.) should render the EmptyState component instead of blank rectangles.",
    },
    schema: [],
    messages: {
      missingEmptyState:
        "Empty-data branch detected without an <EmptyState /> component. Import and render EmptyState to avoid blank rectangles.",
    },
  },
  create(context) {
    /** Track whether this file imports EmptyState */
    let hasEmptyStateImport = false;

    /**
     * Detect common empty-data test patterns:
     *   data.length === 0, items.length === 0, arr.length == 0
     *   !data, !items (unary not on identifier)
     *   data.length === 0 as the left or right of ===
     */
    function isEmptyDataTest(node) {
      if (node.type === "UnaryExpression" && node.operator === "!") {
        return node.argument.type === "Identifier";
      }
      if (node.type === "BinaryExpression" && (node.operator === "===" || node.operator === "==")) {
        return isLengthZero(node.left, node.right) || isLengthZero(node.right, node.left);
      }
      return false;
    }

    function isLengthZero(a, b) {
      return (
        a.type === "MemberExpression" &&
        a.property.type === "Identifier" &&
        a.property.name === "length" &&
        b.type === "Literal" &&
        b.value === 0
      );
    }

    /** Check whether the consequent block (or any of its descendants) contains <EmptyState />. */
    function containsEmptyStateJSX(node) {
      if (!node) return false;
      if (
        node.type === "JSXElement" &&
        node.openingElement.name &&
        node.openingElement.name.name === "EmptyState"
      ) {
        return true;
      }
      if (node.type === "JSXIdentifier" && node.name === "EmptyState") {
        return true;
      }
      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const child = node[key];
        if (child && typeof child === "object") {
          if (Array.isArray(child)) {
            if (child.some((c) => c && typeof c.type === "string" && containsEmptyStateJSX(c))) {
              return true;
            }
          } else if (typeof child.type === "string" && containsEmptyStateJSX(child)) {
            return true;
          }
        }
      }
      return false;
    }

    return {
      ImportDeclaration(node) {
        if (
          node.specifiers.some(
            (s) =>
              (s.type === "ImportDefaultSpecifier" || s.type === "ImportSpecifier") &&
              s.local.name === "EmptyState",
          )
        ) {
          hasEmptyStateImport = true;
        }
      },
      IfStatement(node) {
        if (!isEmptyDataTest(node.test)) return;
        if (containsEmptyStateJSX(node.consequent)) return;
        context.report({ node: node.test, messageId: "missingEmptyState" });
      },
      ConditionalExpression(node) {
        if (!isEmptyDataTest(node.test)) return;
        if (containsEmptyStateJSX(node.consequent) || containsEmptyStateJSX(node.alternate)) return;
        context.report({ node: node.test, messageId: "missingEmptyState" });
      },
    };
  },
};
