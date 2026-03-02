import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/consistent-typography-variants.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/consistent-typography-variants", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("consistent-typography-variants", rule, {
      valid: [
        // Allowed variants
        {
          code: `<Typography variant="body2">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Typography variant="h5">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Typography variant="caption">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // No variant prop — fine
        {
          code: `<Typography>text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // h3 is the metric display variant
        {
          code: `<Typography variant="h3">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Custom options
        {
          code: `<Typography variant="h1">text</Typography>`,
          options: [{ allowed: ["h1"] }],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // JSXExpressionContainer with valid variant
        {
          code: `<Typography variant={"subtitle1"}>text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        // h2 is not in the allowed set
        {
          code: `<Typography variant="h2">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // JSXExpressionContainer with invalid variant
        {
          code: `<Typography variant={"h2"}>text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // Off-scale with custom options
        {
          code: `<Typography variant="body1">text</Typography>`,
          options: [{ allowed: ["h1"] }],
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // h4 is not in the default allowed set
        {
          code: `<Typography variant="h4">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // h6 removed from allowed set
        {
          code: `<Typography variant="h6">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // subtitle2 removed from allowed set
        {
          code: `<Typography variant="subtitle2">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
        // overline removed from allowed set
        {
          code: `<Typography variant="overline">text</Typography>`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "invalidVariant" }],
        },
      ],
    });
  });
});
