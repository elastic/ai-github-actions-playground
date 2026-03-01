import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/max-component-lines.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/max-component-lines", () => {
  it("passes RuleTester valid/invalid cases", () => {
    const shortFile = Array.from({ length: 10 }, (_, i) => `const a${i} = 1;`).join("\n");
    const longFile = Array.from({ length: 201 }, (_, i) => `const a${i} = 1;`).join("\n");
    const boundaryFile = Array.from({ length: 200 }, (_, i) => `const a${i} = 1;`).join("\n");

    tester.run("max-component-lines", rule, {
      valid: [
        { code: shortFile, options: [{ max: 200 }] },
        { code: boundaryFile, options: [{ max: 200 }] },
      ],
      invalid: [
        {
          code: longFile,
          options: [{ max: 200 }],
          errors: [{ messageId: "tooManyLines" }],
        },
      ],
    });
  });
});
