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
        // Theme tokens in ECharts are fine
        {
          code: `import * as echarts from "echarts"; const option = { color: "primary.main" };`,
        },
      ],
      invalid: [
        // Hex in sx prop
        {
          code: `<Box sx={{ color: "#FF0000" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noHardcodedColor" }],
        },
        // Hardcoded color in ECharts file
        {
          code: `import * as echarts from "echarts"; const option = { color: "#FF0000" };`,
          errors: [{ messageId: "noHardcodedColor" }],
        },
        // Template literal with hex in sx
        {
          code: `<Box sx={{ border: \`1px solid #FF0000\` }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noHardcodedColor" }],
        },
        // Template literal with rgb in sx
        {
          code: `<Box sx={{ border: \`1px solid rgb(255,0,0)\` }} />`,
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
