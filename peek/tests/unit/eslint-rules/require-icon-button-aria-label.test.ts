import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/require-icon-button-aria-label.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/require-icon-button-aria-label", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("require-icon-button-aria-label", rule, {
      valid: [
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton aria-label="Filter by value" size="small"><FilterIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Not an IconButton import — should be ignored
        {
          code: `
            import Button from "@mui/material/Button";
            function Component() {
              return <Button onClick={onClick}>Click</Button>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // IconButton not imported from MUI — should be ignored
        {
          code: `
            function IconButton({ children }) { return <button>{children}</button>; }
            function Component() {
              return <IconButton onClick={onClick}><Icon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton onClick={onClose}><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton size="small" onClick={onFilter}><FilterIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
        // Multiple IconButtons, one missing aria-label
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return (
                <>
                  <IconButton aria-label="OK"><CheckIcon /></IconButton>
                  <IconButton onClick={onClose}><CloseIcon /></IconButton>
                </>
              );
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
      ],
    });
  });
});
