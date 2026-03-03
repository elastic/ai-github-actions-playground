import noHardcodedColors from "./rules/no-hardcoded-colors.js";
import enforceEmptyState from "./rules/enforce-empty-state.js";
import maxComponentLines from "./rules/max-component-lines.js";
import consistentTypographyVariants from "./rules/consistent-typography-variants.js";
import noDirectEChartsImport from "./rules/no-direct-echarts-import.js";
import noDivOnClick from "./rules/no-div-onclick.js";
import noCircularProgress from "./rules/no-circular-progress.js";
import enforceSpacingTokens from "./rules/enforce-spacing-tokens.js";
import requireIconButtonAriaLabel from "./rules/require-icon-button-aria-label.js";
import noHardcodedHeights from "./rules/no-hardcoded-heights.js";

const plugin = {
  meta: { name: "eslint-plugin-peek", version: "1.0.0" },
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
    "enforce-empty-state": enforceEmptyState,
    "max-component-lines": maxComponentLines,
    "consistent-typography-variants": consistentTypographyVariants,
    "no-direct-echarts-import": noDirectEChartsImport,
    "no-div-onclick": noDivOnClick,
    "no-circular-progress": noCircularProgress,
    "enforce-spacing-tokens": enforceSpacingTokens,
    "require-icon-button-aria-label": requireIconButtonAriaLabel,
    "no-hardcoded-heights": noHardcodedHeights,
  },
};

export default plugin;
