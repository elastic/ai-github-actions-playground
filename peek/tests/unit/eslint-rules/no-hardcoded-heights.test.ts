import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/no-hardcoded-heights.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/no-hardcoded-heights", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("no-hardcoded-heights", rule, {
      valid: [
        // Using the token constant is fine
        {
          code: `<Box sx={{ height: COMPONENT_HEIGHTS.button }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Heights that don't match any token are fine (e.g. chart containers, icons)
        {
          code: `<Box sx={{ height: 200 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ height: 120 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<Box sx={{ height: 16 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // String values are fine
        {
          code: `<Box sx={{ height: "100%" }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Not an sx prop
        {
          code: `<Box style={{ height: 36 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        // 36 matches COMPONENT_HEIGHTS.button / .input / .tableRow / .tab
        {
          code: `<Box sx={{ height: 36 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
        // 28 matches COMPONENT_HEIGHTS.buttonSmall
        {
          code: `<Chip sx={{ height: 28 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
        // 44 matches COMPONENT_HEIGHTS.toolbarRow / .touchTarget
        {
          code: `<Box sx={{ minHeight: 44 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
        // 32 matches COMPONENT_HEIGHTS.sidebarNavItem
        {
          code: `<ListItem sx={{ height: 32 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
        // Nested in responsive object
        {
          code: `<Box sx={{ "&:hover": { height: 36 } }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
        // maxHeight
        {
          code: `<Box sx={{ maxHeight: 44 }} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "useHeightToken" }],
        },
      ],
    });
  });
});
