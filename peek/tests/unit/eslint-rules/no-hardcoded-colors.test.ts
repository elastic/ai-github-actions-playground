import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/no-hardcoded-colors.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/no-hardcoded-colors", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("no-hardcoded-colors", rule, {
      valid: [
        // Theme token references in sx are fine
        {
          code: `<Box sx={{ color: "primary.main" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Hardcoded colors outside sx/style are fine
        { code: `const x = "#FF0000";` },
      ],
      invalid: [
        // Hex in sx prop
        {
          code: `<Box sx={{ color: "#FF0000" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noHardcodedColor" }],
        },
        // rgba() in style prop
        {
          code: `<Box style={{ color: "rgba(0,0,0,0.5)" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noHardcodedColor" }],
        },
        // rgb() in sx prop
        {
          code: `<Box sx={{ background: "rgb(255,0,0)" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noHardcodedColor" }],
        },
      ],
    });
  });
});
