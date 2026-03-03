import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import muiPlugin from "eslint-plugin-mui";
import testingLibrary from "eslint-plugin-testing-library";
import eslintConfigPrettier from "eslint-config-prettier";

import peekPlugin from "./eslint-plugin-peek/index.js";

export default tseslint.config(
  { ignores: ["dist", "src/services/es/types.generated.d.ts", "eslint-plugin-peek/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.strict,
  },
  {
    plugins: { import: importPlugin },
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
      "import/no-duplicates": "error",
    },
  },
  // MUI barrel import restriction — require path imports (e.g. '@mui/material/Button')
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@mui/(material|icons-material|lab)$",
              message:
                "Import from the specific module path (e.g. '@mui/material/Button') instead of the barrel export.",
            },
          ],
        },
      ],
    },
  },
  // Prevent components from importing directly from services/es/client.
  // Components should import from hooks/ or from services/es (barrel) instead.
  {
    files: ["src/components/**/*.ts", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@mui/(material|icons-material|lab)$",
              message:
                "Import from the specific module path (e.g. '@mui/material/Button') instead of the barrel export.",
            },
            {
              regex: "services/es/client$",
              message:
                "Import from the services/es barrel (services/es) or from hooks/ instead of services/es/client directly.",
            },
          ],
        },
      ],
    },
  },
  // eslint-plugin-mui — sort sx keys for consistent ordering
  {
    files: ["src/**/*.tsx"],
    plugins: { mui: muiPlugin },
    rules: {
      "mui/sort-sx-keys": "warn",
    },
  },
  // Custom Peek design-language rules
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { peek: peekPlugin },
    rules: {
      "peek/no-hardcoded-colors": "error",
      "peek/consistent-typography-variants": "error",
      "peek/no-direct-echarts-import": "error",
      "peek/no-div-onclick": "error",
      "peek/enforce-spacing-tokens": "error",
    },
  },
  // rules that only apply to component files
  {
    files: ["src/components/**/*.tsx"],
    plugins: { peek: peekPlugin },
    rules: {
      "peek/max-component-lines": ["warn", { max: 200 }],
      "peek/enforce-empty-state": "error",
      "peek/no-circular-progress": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    ...testingLibrary.configs["flat/react"],
  },
  eslintConfigPrettier,
);
