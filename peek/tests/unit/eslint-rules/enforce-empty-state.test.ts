import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/enforce-empty-state.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/enforce-empty-state", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("enforce-empty-state", rule, {
      valid: [
        // File that imports EmptyState is always valid
        {
          code: `import EmptyState from "./EmptyState";\nif (data.length === 0) { console.log("empty"); }`,
        },
        // No empty-data pattern at all
        { code: `if (x > 5) { doSomething(); }` },
      ],
      invalid: [
        // .length === 0 without EmptyState import
        {
          code: `if (data.length === 0) { console.log("empty"); }`,
          errors: [{ messageId: "missingEmptyState" }],
        },
        // !data without EmptyState import
        {
          code: `if (!data) { console.log("empty"); }`,
          errors: [{ messageId: "missingEmptyState" }],
        },
      ],
    });
  });
});
