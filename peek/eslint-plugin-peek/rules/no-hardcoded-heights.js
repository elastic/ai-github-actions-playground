/**
 * Component heights that have tokens in COMPONENT_HEIGHTS (src/types/tokens.ts).
 * If a numeric height in sx matches one of these, it should use the token instead.
 */
const TOKEN_HEIGHTS = new Map([
  [28, "COMPONENT_HEIGHTS.buttonSmall"],
  [32, "COMPONENT_HEIGHTS.sidebarNavItem"],
  [36, "COMPONENT_HEIGHTS.button / .input / .tableRow / .tab"],
  [44, "COMPONENT_HEIGHTS.toolbarRow / .touchTarget"],
]);

const HEIGHT_KEYS = new Set(["height", "minHeight", "maxHeight"]);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow hardcoded pixel heights in sx props when a COMPONENT_HEIGHTS token exists. Import from src/types/tokens.ts instead.",
    },
    schema: [],
    messages: {
      useHeightToken:
        "Hardcoded height {{value}}px matches a design token. Use {{token}} from 'src/types/tokens' instead.",
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

    function getNumericValue(node) {
      if (node.type === "Literal" && typeof node.value === "number") return node.value;
      return null;
    }

    function validateObjectExpression(expression) {
      for (const property of expression.properties) {
        if (property.type !== "Property") continue;
        if (property.value.type === "ObjectExpression") {
          validateObjectExpression(property.value);
          continue;
        }

        const propertyName = getPropertyName(property);
        if (!propertyName || !HEIGHT_KEYS.has(propertyName)) continue;
        const value = getNumericValue(property.value);
        if (value === null) continue;
        const token = TOKEN_HEIGHTS.get(value);
        if (!token) continue;

        context.report({
          node: property.value,
          messageId: "useHeightToken",
          data: { value: String(value), token },
        });
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "sx") return;
        if (!node.value || node.value.type !== "JSXExpressionContainer") return;
        const expression = node.value.expression;
        if (expression.type !== "ObjectExpression") return;
        validateObjectExpression(expression);
      },
    };
  },
};
