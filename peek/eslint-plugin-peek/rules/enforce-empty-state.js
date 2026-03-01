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

    /**
     * Return true when a ReturnStatement yields a non-JSX value such as
     * `null`, `0`, `[]`, or `{ key: value }`.  These are data-flow guards,
     * not render decisions, so the rule should ignore them.
     */
    function isNonJSXReturn(returnStmt) {
      if (!returnStmt.argument) return true; // return;
      const arg = returnStmt.argument;
      if (arg.type === "Literal") return true; // return null / 0 / ""
      if (arg.type === "ArrayExpression") return true; // return []
      if (arg.type === "ObjectExpression") return true; // return { ... }
      if (arg.type === "Identifier" && arg.name === "undefined") return true;
      return false;
    }

    /** Check if an IfStatement is a guard clause (returns non-JSX, or throws) */
    function isGuardClause(node) {
      if (node.type !== "IfStatement") return false;
      const consequent = node.consequent;

      // if (...) return <non-JSX>;
      if (consequent.type === "ReturnStatement") return isNonJSXReturn(consequent);

      // if (...) { ...; return <non-JSX>; } or if (...) { throw ... }
      if (consequent.type === "BlockStatement" && consequent.body.length > 0) {
        const last = consequent.body[consequent.body.length - 1];
        if (last.type === "ThrowStatement") return true;
        if (last.type === "ReturnStatement") return isNonJSXReturn(last);
      }

      return false;
    }

    /**
     * Return true when the node sits inside a callback passed to useMemo,
     * useEffect, useCallback, or useLayoutEffect — these are data-flow
     * hooks, not render functions, so empty-data checks there are not about
     * showing UI.
     */
    const NON_RENDER_HOOKS = new Set(["useMemo", "useEffect", "useCallback", "useLayoutEffect"]);
    function isInsideNonRenderHookCallback(node) {
      let current = node.parent;
      while (current) {
        if (
          (current.type === "ArrowFunctionExpression" || current.type === "FunctionExpression") &&
          current.parent?.type === "CallExpression" &&
          current.parent.callee?.type === "Identifier" &&
          NON_RENDER_HOOKS.has(current.parent.callee.name)
        ) {
          return true;
        }
        current = current.parent;
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
      IfStatement(node) {
        if (!isEmptyDataTest(node.test)) return;
        if (isGuardClause(node)) return;
        if (isInsideNonRenderHookCallback(node)) return;
        if (!containsEmptyStateJSX(node.consequent)) {
          context.report({ node: node.test, messageId: "missingEmptyState" });
        }
      },
      ConditionalExpression(node) {
        if (!isEmptyDataTest(node.test)) return;
        if (isInsideNonRenderHookCallback(node)) return;
        if (!containsEmptyStateJSX(node.consequent)) {
          context.report({ node: node.test, messageId: "missingEmptyState" });
        }
      },
    };
  },
};
