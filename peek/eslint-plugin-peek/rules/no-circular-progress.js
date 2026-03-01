/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow CircularProgress in component loading states. Use ContentSkeleton or LinearProgress instead.",
    },
    schema: [],
    messages: {
      noCircularProgressImport:
        "Do not import CircularProgress from '@mui/material/CircularProgress' in components. Use ContentSkeleton for structural loading or LinearProgress for progress bars.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalizedFilename = filename.replace(/\\/g, "/");
    if (normalizedFilename.includes("src/components/visualizations/")) {
      return {};
    }

    /** @type {import('estree').ImportDeclaration | null} */
    let circularProgressImport = null;
    const localNames = new Set();
    let hasCircularProgressUsage = false;
    let hasDisallowedUsage = false;

    function getJSXRootName(node) {
      if (!node) return null;
      if (node.type === "JSXIdentifier") return node.name;
      if (node.type === "JSXMemberExpression") return getJSXRootName(node.object);
      return null;
    }

    function getNumericSizeProp(openingElement) {
      const sizeAttr = openingElement.attributes.find(
        (attr) => attr.type === "JSXAttribute" && attr.name.name === "size",
      );
      if (!sizeAttr || !sizeAttr.value) return null;
      if (sizeAttr.value.type === "Literal" && typeof sizeAttr.value.value === "number") {
        return sizeAttr.value.value;
      }
      if (
        sizeAttr.value.type === "JSXExpressionContainer" &&
        sizeAttr.value.expression.type === "Literal" &&
        typeof sizeAttr.value.expression.value === "number"
      ) {
        return sizeAttr.value.expression.value;
      }
      return null;
    }

    function isInsideButton(node) {
      let current = node.parent;
      while (current) {
        if (current.type === "JSXElement") {
          const openingName = current.openingElement?.name;
          if (openingName?.type === "JSXIdentifier" && openingName.name === "Button") {
            return true;
          }
        }
        if (current.type === "JSXOpeningElement") {
          const openingName = current.name;
          if (openingName.type === "JSXIdentifier" && openingName.name === "Button") {
            return true;
          }
        }
        current = current.parent;
      }
      return false;
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "@mui/material/CircularProgress") return;
        circularProgressImport = node;
        for (const specifier of node.specifiers) {
          localNames.add(specifier.local.name);
        }
      },
      JSXOpeningElement(node) {
        const rootName = getJSXRootName(node.name);
        if (!rootName || !localNames.has(rootName)) return;

        hasCircularProgressUsage = true;
        const size = getNumericSizeProp(node);
        const allowedBySize = typeof size === "number" && size > 0 && size <= 16;
        const allowedInButton = isInsideButton(node);
        if (!allowedBySize && !allowedInButton) {
          hasDisallowedUsage = true;
        }
      },
      "Program:exit"() {
        if (!circularProgressImport) return;
        if (!hasCircularProgressUsage || hasDisallowedUsage) {
          context.report({ node: circularProgressImport, messageId: "noCircularProgressImport" });
        }
      },
    };
  },
};
