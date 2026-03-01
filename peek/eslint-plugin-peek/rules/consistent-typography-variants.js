/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Restrict Typography variant prop to the approved design-language type scale. Prevents agents from using off-scale variants like h3.",
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
      "h5",
      "h6",
      "subtitle1",
      "subtitle2",
      "body1",
      "body2",
      "caption",
      "overline",
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
            attr.value &&
            attr.value.type === "Literal" &&
            typeof attr.value.value === "string"
          ) {
            if (!allowedSet.has(attr.value.value)) {
              context.report({
                node: attr.value,
                messageId: "invalidVariant",
                data: {
                  variant: attr.value.value,
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
