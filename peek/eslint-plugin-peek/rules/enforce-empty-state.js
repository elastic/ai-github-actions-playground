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
     *   !data, !results, etc.
     */
    function isEmptyDataTest(node) {
      const DATA_IDENTIFIERS = new Set([
        "data",
        "results",
        "result",
        "metrics",
        "items",
        "spans",
        "indices",
        "pipelines",
        "fields",
      ]);

      if (node.type === "UnaryExpression" && node.operator === "!") {
        return node.argument.type === "Identifier" && DATA_IDENTIFIERS.has(node.argument.name);
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

    /** Check if an IfStatement is a guard clause (returns nothing, null, or throws) */
    function isGuardClause(node) {
      if (node.type !== "IfStatement") return false;
      const consequent = node.consequent;

      // if (...) return;
      if (consequent.type === "ReturnStatement" && !consequent.argument) return true;

      // if (...) { return; } or if (...) { throw ... }
      if (consequent.type === "BlockStatement") {
        const first = consequent.body[0];
        if (!first) return false;
        if (first.type === "ReturnStatement" && !first.argument) return true;
        if (first.type === "ThrowStatement") return true;
      }

      return false;
    }

    /** Check whether a node contains <EmptyState />. */
    function containsEmptyStateJSX(node) {
      if (!node) return false;
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const text = sourceCode.getText(node);
      // Heuristic: check if the text contains "<EmptyState"
      return /<EmptyState\b/.test(text);
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
        if (isGuardClause(node)) return;
        if (!hasEmptyStateImport || !containsEmptyStateJSX(node.consequent)) {
          context.report({ node: node.test, messageId: "missingEmptyState" });
        }
      },
      ConditionalExpression(node) {
        if (!isEmptyDataTest(node.test)) return;
        if (!hasEmptyStateImport || !containsEmptyStateJSX(node.consequent)) {
          context.report({ node: node.test, messageId: "missingEmptyState" });
        }
      },
    };
  },
};
