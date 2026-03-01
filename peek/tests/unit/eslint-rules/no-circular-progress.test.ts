import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/no-circular-progress.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/no-circular-progress", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("no-circular-progress", rule, {
      valid: [
        {
          code: `import LinearProgress from "@mui/material/LinearProgress"; function Component(){ return <LinearProgress />; }`,
          filename: "src/components/UsersPage.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            import Button from "@mui/material/Button";
            function Component() {
              return <Button startIcon={<CircularProgress />}>Refresh</Button>;
            }
          `,
          filename: "src/components/UsersPage.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            function Component() {
              return <CircularProgress size={14} />;
            }
          `,
          filename: "src/components/UsersPage.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            function Component() {
              return <CircularProgress />;
            }
          `,
          filename: "src/components/visualizations/Sparkline.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        },
      ],
      invalid: [
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            function Component() {
              return <CircularProgress />;
            }
          `,
          filename: "src/components/UsersPage.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noCircularProgressImport" }],
        },
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            function Component() {
              return <CircularProgress size={20} />;
            }
          `,
          filename: "src/components/UsersPage.tsx",
          languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
          errors: [{ messageId: "noCircularProgressImport" }],
        },
        {
          code: `
            import CircularProgress from "@mui/material/CircularProgress";
            const value = 42;
          `,
          filename: "src/components/UsersPage.tsx",
          errors: [{ messageId: "noCircularProgressImport" }],
        },
      ],
    });
  });
});
