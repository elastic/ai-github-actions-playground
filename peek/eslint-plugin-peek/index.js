import noHardcodedColors from "./rules/no-hardcoded-colors.js";
import enforceEmptyState from "./rules/enforce-empty-state.js";
import maxComponentLines from "./rules/max-component-lines.js";
import consistentTypographyVariants from "./rules/consistent-typography-variants.js";

const plugin = {
  meta: { name: "eslint-plugin-peek", version: "1.0.0" },
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
    "enforce-empty-state": enforceEmptyState,
    "max-component-lines": maxComponentLines,
    "consistent-typography-variants": consistentTypographyVariants,
  },
};

export default plugin;
