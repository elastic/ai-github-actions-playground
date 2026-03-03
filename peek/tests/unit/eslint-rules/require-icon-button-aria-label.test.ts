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
        // Named import style — with aria-label should pass
        {
          code: `
            import { IconButton } from "@mui/material/IconButton";
            function Component() {
              return <IconButton aria-label="Close"><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // Barrel import style — with aria-label should pass
        {
          code: `
            import { IconButton } from "@mui/material";
            function Component() {
              return <IconButton aria-label="Close"><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        // aria-label as expression (variable) — conservatively accepted
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            const label = "Close";
            function Component() {
              return <IconButton aria-label={label}><CloseIcon /></IconButton>;
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
        // Named import style — without aria-label should fail
        {
          code: `
            import { IconButton } from "@mui/material/IconButton";
            function Component() {
              return <IconButton onClick={onClose}><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
        // Barrel import style — without aria-label should fail
        {
          code: `
            import { IconButton } from "@mui/material";
            function Component() {
              return <IconButton onClick={onClose}><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
        // aria-label="" — empty string should fail
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton aria-label=""><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
        // aria-label={undefined} — should fail
        {
          code: `
            import IconButton from "@mui/material/IconButton";
            function Component() {
              return <IconButton aria-label={undefined}><CloseIcon /></IconButton>;
            }
          `,
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "missingAriaLabel" }],
        },
      ],
    });
  });
});
