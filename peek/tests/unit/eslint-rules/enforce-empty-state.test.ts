import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/enforce-empty-state.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe("peek/enforce-empty-state", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("enforce-empty-state", rule, {
      valid: [
        // Import + usage in empty branch
        {
          code: `
            import EmptyState from "./EmptyState";
            function Component() {
              if (data.length === 0) { return <EmptyState heading="No data" />; }
              return <div>{data}</div>;
            }
          `,
        },
        // Ternary with EmptyState
        {
          code: `
            import EmptyState from "./EmptyState";
            function Component() {
              return data.length === 0 ? <EmptyState heading="Empty" /> : <div>Data</div>;
            }
          `,
        },
        // No empty-data pattern at all
        { code: `function Component() { if (x > 5) { doSomething(); } }` },
        // Guard clause (return) - ignored
        { code: `function Component() { if (!data) return; }` },
        // Guard clause (block return) - ignored
        { code: `function Component() { if (!data) { return; } }` },
        // Guard clause (throw) - ignored
        { code: `function Component() { if (!data) { throw new Error(); } }` },
        // Guard clause: return null (component defers to parent)
        { code: `function Component() { if (data.length === 0) return null; }` },
        // Guard clause: return [] (data transformation)
        { code: `function Component() { if (data.length === 0) return []; }` },
        // Guard clause: return 0 (computed value)
        { code: `function Component() { if (data.length === 0) return 0; }` },
        // Guard clause: return { ... } (chart config object)
        { code: `function Component() { if (data.length === 0) return { title: "empty" }; }` },
        // Guard clause: block with state-setting before return null
        {
          code: `function Component() {
            if (items.length === 0) {
              setResults([]);
              return;
            }
          }`,
        },
        // Inside useMemo callback - not a render decision
        {
          code: `function Component() {
            const val = useMemo(() => {
              if (data.length === 0) return <div />;
              return <span />;
            }, [data]);
          }`,
        },
        // Inside useEffect callback - not a render decision
        {
          code: `function Component() {
            useEffect(() => {
              if (items.length === 0) { doSomething(); }
            }, [items]);
          }`,
        },
        // Ternary inside useEffect - not a render decision
        {
          code: `function Component() {
            useEffect(() => {
              const x = data.length === 0 ? "a" : "b";
            }, [data]);
          }`,
        },
        // Non-data identifier - ignored
        { code: `function Component() { if (!isReady) { return <div />; } }` },
      ],
      invalid: [
        // .length === 0 without EmptyState usage
        {
          code: `function Component() { if (data.length === 0) { return <div />; } }`,
          errors: [{ messageId: "missingEmptyState" }],
        },
        // !data without EmptyState usage
        {
          code: `function Component() { if (!data) { return <div />; } }`,
          errors: [{ messageId: "missingEmptyState" }],
        },
        // Even if imported, it must be used in the branch
        {
          code: `
            import EmptyState from "./EmptyState";
            function Component() {
              if (data.length === 0) { return <div />; }
            }
          `,
          errors: [{ messageId: "missingEmptyState" }],
        },
        // Missing import should fail, even if EmptyState JSX appears
        {
          code: `function Component() { return data.length === 0 ? <EmptyState /> : <div />; }`,
          errors: [{ messageId: "missingEmptyState" }],
        },
        // Ternary with EmptyState in wrong branch should fail
        {
          code: `
            import EmptyState from "./EmptyState";
            function Component() {
              return data.length === 0 ? <div /> : <EmptyState heading="Empty" />;
            }
          `,
          errors: [{ messageId: "missingEmptyState" }],
        },
      ],
    });
  });
});
