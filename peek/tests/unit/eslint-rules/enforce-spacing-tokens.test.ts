import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/enforce-spacing-tokens.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/enforce-spacing-tokens", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("enforce-spacing-tokens", rule, {
      valid: [
        {
          code: `<Box sx={{ p: 2, px: 1.5, mt: 0.5, gap: 3 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ p: spacingValue, py: 2 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={styles.container} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ borderRadius: 8, color: "text.primary" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ p: 0, gap: 6 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ "&:hover": { p: 2 } }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        {
          code: `<Box sx={{ py: 0.25 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidSpacingToken" }],
        },
        {
          code: `<Box sx={{ p: 5, gap: 7 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidSpacingToken" }, { messageId: "invalidSpacingToken" }],
        },
        {
          code: `<Box sx={{ "mx": 9 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidSpacingToken" }],
        },
        {
          code: `<Box sx={{ mt: -2 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidSpacingToken" }],
        },
        {
          code: `<Box sx={{ "&:hover": { p: 5 } }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidSpacingToken" }],
        },
      ],
    });
  });
});
