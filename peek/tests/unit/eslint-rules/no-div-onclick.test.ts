import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/no-div-onclick.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/no-div-onclick", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("no-div-onclick", rule, {
      valid: [
        {
          code: `<Button onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<IconButton onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<ListItemButton onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `<div className="foo" />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        {
          code: `<div onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noDivOnClick", data: { name: "div" } }],
        },
        {
          code: `<span onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noDivOnClick", data: { name: "span" } }],
        },
        {
          code: `<Box onClick={() => {}} />`,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noDivOnClick", data: { name: "Box" } }],
        },
      ],
    });
  });
});
