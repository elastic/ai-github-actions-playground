/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow onClick on non-interactive elements like div and span.",
    },
    schema: [],
    messages: {
      noDivOnClick:
        "Do not use onClick on a <{{name}}>. Use a <Button>, <IconButton>, or <ListItemButton> to ensure keyboard accessibility.",
    },
  },
  create(context) {
    const BANNED_ELEMENTS = new Set(["div", "span", "Box"]);

    function isOnlyStopPropagation(node) {
      if (!node.value || node.value.type !== "JSXExpressionContainer") return false;
      const expression = node.value.expression;
      if (expression.type !== "ArrowFunctionExpression") return false;

      const firstParam = expression.params[0];
      const eventParamName =
        firstParam && firstParam.type === "Identifier" ? firstParam.name : null;
      if (!eventParamName) return false;

      // Case: (e) => e.stopPropagation()
      if (
        expression.body.type === "CallExpression" &&
        expression.body.callee.type === "MemberExpression" &&
        expression.body.callee.object.type === "Identifier" &&
        expression.body.callee.object.name === eventParamName &&
        expression.body.callee.property.name === "stopPropagation"
      ) {
        return true;
      }

      // Case: (e) => { e.stopPropagation(); }
      if (
        expression.body.type === "BlockStatement" &&
        expression.body.body.length === 1 &&
        expression.body.body[0].type === "ExpressionStatement" &&
        expression.body.body[0].expression.type === "CallExpression" &&
        expression.body.body[0].expression.callee.type === "MemberExpression" &&
        expression.body.body[0].expression.callee.object.type === "Identifier" &&
        expression.body.body[0].expression.callee.object.name === eventParamName &&
        expression.body.body[0].expression.callee.property.name === "stopPropagation"
      ) {
        return true;
      }

      return false;
    }

    return {
      JSXOpeningElement(node) {
        const name = node.name.name || (node.name.type === "JSXIdentifier" ? node.name.name : null);
        if (!name || !BANNED_ELEMENTS.has(name)) return;

        const componentAttr = node.attributes.find(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "component",
        );

        let isButtonComponent = false;
        if (componentAttr && componentAttr.value) {
          if (componentAttr.value.type === "Literal") {
            isButtonComponent = componentAttr.value.value === "button";
          } else if (
            componentAttr.value.type === "JSXExpressionContainer" &&
            componentAttr.value.expression.type === "Literal"
          ) {
            isButtonComponent = componentAttr.value.expression.value === "button";
          }
        }

        if (isButtonComponent) return;

        const onClickAttr = node.attributes.find(
          (attr) => attr.type === "JSXAttribute" && attr.name.name === "onClick",
        );

        if (onClickAttr && !isOnlyStopPropagation(onClickAttr)) {
          context.report({
            node,
            messageId: "noDivOnClick",
            data: { name },
          });
        }
      },
    };
  },
};
