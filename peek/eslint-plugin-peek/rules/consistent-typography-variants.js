/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Restrict Typography variant prop to the approved design-language type scale.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowed: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidVariant:
        "Typography variant '{{variant}}' is not in the approved type scale ({{allowed}}). Use one of the allowed variants.",
    },
  },
  create(context) {
    const allowed = (context.options[0] && context.options[0].allowed) || [
      "h3",
      "h5",
      "subtitle1",
      "body1",
      "body2",
      "caption",
    ];
    const allowedSet = new Set(allowed);

    return {
      JSXOpeningElement(node) {
        const name = node.name;
        if (name.type !== "JSXIdentifier" || name.name !== "Typography") return;

        for (const attr of node.attributes) {
          if (
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.name === "variant" &&
            attr.value
          ) {
            const variantValue =
              attr.value.type === "Literal" && typeof attr.value.value === "string"
                ? attr.value.value
                : attr.value.type === "JSXExpressionContainer" &&
                    attr.value.expression &&
                    attr.value.expression.type === "Literal" &&
                    typeof attr.value.expression.value === "string"
                  ? attr.value.expression.value
                  : null;

            if (variantValue && !allowedSet.has(variantValue)) {
              context.report({
                node: attr.value,
                messageId: "invalidVariant",
                data: {
                  variant: variantValue,
                  allowed: allowed.join(", "),
                },
              });
            }
          }
        }
      },
    };
  },
};
