/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce a maximum line count for component files in src/components/. Large components should be decomposed.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyLines:
        "Component file has {{actual}} lines, exceeding the {{max}}-line limit. Decompose into smaller components.",
    },
  },
  create(context) {
    const max = (context.options[0] && context.options[0].max) || 200;

    return {
      Program(node) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const lines = sourceCode.lines
          ? sourceCode.lines.length
          : sourceCode.getText().split("\n").length;
        if (lines > max) {
          context.report({
            node,
            messageId: "tooManyLines",
            data: { actual: String(lines), max: String(max) },
          });
        }
      },
    };
  },
};
