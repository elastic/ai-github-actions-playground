const SPACING_KEYS = new Set([
  "p",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "m",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "gap",
]);

const SPACE_TOKENS = new Set([0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce SpaceToken usage for numeric sx spacing values (0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6).",
    },
    schema: [],
    messages: {
      invalidSpacingToken:
        "Spacing token '{{property}}: {{value}}' is not in SpaceToken. Use one of: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6.",
    },
  },
  create(context) {
    function getPropertyName(property) {
      if (!property.computed && property.key.type === "Identifier") return property.key.name;
      if (property.key.type === "Literal" && typeof property.key.value === "string") {
        return property.key.value;
      }
      return null;
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "sx") return;
        if (!node.value || node.value.type !== "JSXExpressionContainer") return;
        const expression = node.value.expression;
        if (expression.type !== "ObjectExpression") return;

        for (const property of expression.properties) {
          if (property.type !== "Property") continue;
          const propertyName = getPropertyName(property);
          if (!propertyName || !SPACING_KEYS.has(propertyName)) continue;
          if (property.value.type !== "Literal" || typeof property.value.value !== "number")
            continue;
          if (SPACE_TOKENS.has(property.value.value)) continue;

          context.report({
            node: property.value,
            messageId: "invalidSpacingToken",
            data: { property: propertyName, value: String(property.value.value) },
          });
        }
      },
    };
  },
};
