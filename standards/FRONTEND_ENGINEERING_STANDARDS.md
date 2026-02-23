# Front-End Engineering Standards

> **Purpose:** This document defines the non-negotiable engineering standards for this React/TypeScript application. Every pull request — whether authored by a human or an AI agent — is reviewed against these requirements. If your code doesn't meet these standards, it doesn't ship.

---

## 1. TypeScript Strictness

We use TypeScript to catch bugs at compile time, not as a suggestion engine.

### Configuration (Non-Negotiable)

```jsonc
// tsconfig.json — these must remain enabled
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

### Type Rules

- **`any` is banned.** Use `unknown` when the type is genuinely uncertain, then narrow it. The only acceptable `any` is in a type assertion on a third-party library boundary with an explanatory comment and an `eslint-disable-next-line` annotation.
- **No type assertions (`as`)** unless interfacing with an untyped external API. Every `as` must have a comment explaining why it's safe.
- **Prefer `interface` over `type` for object shapes.** Use `type` for unions, intersections, mapped types, and utility types. This is a convention for consistency, not a technical requirement.
- **All function parameters and return types must be explicitly typed.** Exception: inline arrow functions in JSX callbacks where the type is inferred from the component's props interface.
- **Use discriminated unions for state modeling.** Don't use `{ data?: T; error?: Error; loading?: boolean }`. Use `{ status: 'idle' } | { status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }`.
- **Generics must have descriptive names** when the function has more than one generic parameter. `<T>` is fine alone; `<T, U>` is not — use `<TItem, TResult>` or similar.
- **`enum` is discouraged.** Use `as const` objects or union types instead. Enums have surprising runtime behavior and don't tree-shake.

### Enforced By

- `@typescript-eslint/no-explicit-any`: `error`
- `@typescript-eslint/no-non-null-assertion`: `error`
- `@typescript-eslint/explicit-function-return-type`: `error` (with `allowExpressions: true`)
- `@typescript-eslint/consistent-type-definitions`: `["error", "interface"]`
- `@typescript-eslint/strict-boolean-expressions`: `error`
- `@typescript-eslint/no-unnecessary-type-assertion`: `error`

---

## 2. React Component Architecture

### Component Structure

Every component lives in its own directory with the following structure:

```
ComponentName/
├── ComponentName.tsx        # The component implementation
├── ComponentName.test.tsx   # Tests (required for non-trivial components)
├── ComponentName.module.css # Styles (CSS Modules)
├── types.ts                 # Exported types/interfaces (if shared)
└── index.ts                 # Public API barrel export
```

The `index.ts` file exports **only the public API** — the component and its public types. Internal helpers, sub-components, and implementation details are not re-exported.

### Component Rules

- **Functional components only.** No class components, ever.
- **One component per file.** Tiny internal helper components (a `<Label>` used only inside a `<FormField>`) may live in the same file, but must not be exported.
- **Props interfaces are always named `{ComponentName}Props`** and exported from the component file or `types.ts`.
- **Default exports are banned.** Use named exports exclusively. Default exports make refactoring harder, break auto-import, and produce inconsistent naming.
- **Components must be pure with respect to their props.** Given the same props and state, a component must render the same output. Side effects belong in `useEffect` or event handlers.
- **No inline function definitions in JSX** for functions that could cause unnecessary re-renders. Extract callbacks with `useCallback` when they are passed as props to memoized children, and only then — don't `useCallback` everything.
- **Prop spreading (`{...props}`) is banned on HTML elements** unless the component is a polymorphic wrapper component that intentionally forwards all props. Even then, use `ComponentPropsWithRef<'element'>` for type safety.

### Composition Over Configuration

- Prefer composition (children, render props, slots) over mega-config-object props.
- A component with more than 8 props is a code smell. Consider decomposing.
- A component file over 200 lines is a code smell. Consider extracting logic into custom hooks.

### Enforced By

- `react/function-component-definition`: `["error", { namedComponents: "arrow-function" }]`
- `react/no-unstable-nested-components`: `error`
- `react/jsx-no-constructed-context-values`: `error`
- `import/no-default-export`: `error`
- `react/jsx-no-useless-fragment`: `error`
- `react/self-closing-comp`: `error`
- `react/jsx-curly-brace-presence`: `["error", { props: "never", children: "never" }]`

---

## 3. State Management

### Hierarchy of State Solutions (Use the Simplest That Works)

1. **Local component state (`useState`)** — default choice for UI state.
2. **Derived state** — compute during render, don't store it. If a value can be calculated from props or other state, calculate it. Never `useEffect` to sync derived state.
3. **`useReducer`** — when state transitions are complex or interdependent.
4. **React Context** — for dependency injection (themes, auth, i18n), **not** for frequently-changing data. Context re-renders every consumer on every change.
5. **URL state (search params, route params)** — for state that should survive navigation and be shareable. Forms filters, pagination, sort order belong here.
6. **Server state (React Query / TanStack Query)** — for all data fetching. Server state is not application state. Don't put API responses in Redux or Context.
7. **Global client state (Zustand or Jotai)** — only when truly global client-side state is needed that doesn't fit the above categories. This should be rare.

### Rules

- **Never use `useEffect` to synchronize state.** If you have `useEffect(() => { setX(derivedFromY) }, [y])`, you have a bug waiting to happen. Compute `x` during render.
- **`useEffect` is for side effects only:** DOM manipulation, subscriptions, network requests, timers. If your effect doesn't interact with something outside of React, you probably don't need it.
- **Custom hooks must start with `use` and encapsulate a single concern.** A hook that manages both auth state and UI toast notifications is doing too much.
- **No prop drilling beyond 2 levels.** If you're passing a prop through a component that doesn't use it just to reach a grandchild, restructure (composition, context, or custom hooks).

### Enforced By

- `react-hooks/rules-of-hooks`: `error`
- `react-hooks/exhaustive-deps`: `error`

---

## 4. Styling

### CSS Modules (Default Approach)

- **CSS Modules are the standard.** Every component has a co-located `.module.css` file.
- **No global CSS except for design tokens and resets.** Global styles live in `src/styles/` and are limited to CSS custom properties (tokens), a minimal CSS reset, and base typography.
- **Class names use camelCase** in CSS Modules (e.g., `.headerContainer`, not `.header-container`). This provides clean object property access in TypeScript.
- **No inline styles** except for truly dynamic values computed at runtime (e.g., positioning from user drag).
- **No `!important`.** Ever. If you need `!important`, your specificity architecture is broken.

### CSS Custom Properties for Theming

```css
/* src/styles/tokens.css */
:root {
  --color-primary: #0077cc;
  --color-text: #1a1a2e;
  --color-text-secondary: #6b7280;
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;
  --color-error: #dc2626;
  --color-success: #16a34a;

  --font-family-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);

  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

- **All visual values must reference design tokens.** Don't hardcode `#0077cc` in a component — use `var(--color-primary)`.
- **Spacing, color, typography, and shadow values must come from the token system.** One-off magic numbers are not allowed.

### Responsive Design

- **Mobile-first.** Base styles target the smallest viewport. Layer up with `min-width` media queries.
- **Use `rem` for typography and spacing.** Use `px` only for borders and shadows.
- **Breakpoints are defined as CSS custom properties or shared constants.** Don't scatter magic pixel values across the codebase.
- **No fixed widths on content containers.** Use `max-width` with percentage or viewport-relative fallbacks.

### Enforced By

- Stylelint with `stylelint-config-standard` and `stylelint-config-css-modules`
- Custom Stylelint rules to flag hardcoded color values and `!important`
- ESLint `react/forbid-component-props` configured to warn on `style` prop usage

---

## 5. Testing

### Requirements

- **Every component with logic or user interaction must have tests.** Pure presentational components that only receive and display data may be exempt, but anything with state, effects, event handlers, or conditional rendering must be tested.
- **Tests must be co-located with the component** in the same directory.
- **Minimum coverage thresholds:** 80% branch coverage for non-trivial components. This is a floor, not a ceiling.

### Test Stack

- **Vitest** as the test runner.
- **React Testing Library** for component tests.
- **`@testing-library/user-event`** for simulating user interactions (never use `fireEvent` directly when `userEvent` is available).
- **`vitest-axe`** for automated accessibility checks on rendered components.

### Testing Philosophy

Tests must follow the Testing Library guiding principle:

> "The more your tests resemble the way your software is used, the more confidence they can give you."

#### Do:

- Query by **accessible role first** (`getByRole`), then by label (`getByLabelText`), then by text (`getByText`). Use `getByTestId` as a last resort.
- Test **user behavior**, not implementation. Click buttons, fill forms, assert on visible output.
- Test **error states, loading states, and empty states** — not just the happy path.
- Use `screen` for all queries (not destructured returns from `render`).
- Use `userEvent.setup()` and interact with it for realistic event simulation.
- Include at least one `axe` accessibility check per component test suite.

#### Don't:

- Don't test internal state. If you're asserting on `useState` values, you're doing it wrong.
- Don't test implementation details. If a refactor that doesn't change behavior breaks your test, the test is bad.
- Don't snapshot test UI components. Snapshots are brittle, produce meaningless diffs, and get rubber-stamped. Test behavior.
- Don't mock what you don't own unless absolutely necessary. Prefer integration-style tests.

### Example: What a Good Test Looks Like

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'vitest-axe';
import { describe, it, expect, vi } from 'vitest';
import { SearchBar } from './SearchBar';

expect.extend(toHaveNoViolations);

describe('SearchBar', () => {
  it('calls onSearch with the input value when submitted', async () => {
    const user = userEvent.setup();
    const handleSearch = vi.fn();

    render(<SearchBar onSearch={handleSearch} />);

    const input = screen.getByRole('searchbox', { name: /search/i });
    await user.type(input, 'test query');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(handleSearch).toHaveBeenCalledWith('test query');
  });

  it('disables the submit button when the input is empty', () => {
    render(<SearchBar onSearch={vi.fn()} />);

    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SearchBar onSearch={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Enforced By

- `vitest` with `--coverage` flag in CI, failing below threshold
- `testing-library/prefer-screen-queries`: `error`
- `testing-library/no-node-access`: `error`
- `testing-library/no-container`: `error`
- `testing-library/prefer-user-event`: `error`
- `testing-library/no-debugging-utils`: `warn`

---

## 6. Code Organization & Imports

### Directory Structure

```
src/
├── components/          # Shared/reusable UI components
│   ├── Button/
│   ├── Modal/
│   └── DataTable/
├── features/            # Feature-specific modules (components + hooks + types)
│   ├── auth/
│   ├── dashboard/
│   └── settings/
├── hooks/               # Shared custom hooks
├── utils/               # Pure utility functions (no React)
├── types/               # Shared TypeScript types
├── styles/              # Global styles, tokens, reset
├── services/            # API clients and external service integrations
├── constants/           # Application-wide constants
└── App.tsx
```

### Import Rules

- **Absolute imports** with path aliases (e.g., `@/components/Button`) for anything outside the current feature directory.
- **Relative imports** for files within the same feature/component directory.
- **Import order is enforced** (groups separated by blank lines):
  1. React and framework imports
  2. Third-party library imports
  3. Absolute internal imports (`@/...`)
  4. Relative imports
  5. Type-only imports (`import type { ... }`)
  6. CSS/asset imports
- **No circular imports.** These cause subtle bugs and break tree-shaking. The dependency graph must be a DAG.
- **Barrel exports (`index.ts`) must not re-export the entire tree.** Export only the public API of each module. Deep barrel exports destroy tree-shaking and increase bundle size.
- **Use `import type` for type-only imports.** This ensures types are erased at compile time and don't affect the bundle.

### Enforced By

- `import/order` with configured groups and `newlines-between: always`
- `import/no-cycle`: `error`
- `@typescript-eslint/consistent-type-imports`: `error`
- `import/no-duplicates`: `error`

---

## 7. Error Handling

- **Every async operation must have explicit error handling.** No unhandled promise rejections. No `.catch(() => {})`.
- **Use Error Boundaries** at feature boundaries. A failing widget should not crash the entire page. Every route-level component and every independent feature panel must be wrapped.
- **Error messages shown to users must be helpful.** "Something went wrong" is not acceptable. Tell the user what happened and what they can do about it.
- **Log errors with structured context.** Include the component name, the operation that failed, and any relevant IDs.
- **Network errors must distinguish between client errors (4xx) and server errors (5xx)** and surface appropriate messages for each.

---

## 8. Performance

- **Measure before you optimize.** Don't `useMemo` and `useCallback` everything. Use React DevTools Profiler to identify actual bottlenecks.
- **Lazy-load routes and heavy features** with `React.lazy()` and `Suspense`. Code-split at the route level at minimum.
- **Virtualize long lists.** If a list can exceed ~50 items, use `react-window` or `@tanstack/react-virtual`. Never render 500+ DOM nodes.
- **Images must be optimized.** Use appropriate formats (WebP/AVIF with fallbacks), include `width` and `height` attributes, and lazy-load below-the-fold images.
- **No synchronous heavy computation in render.** Move expensive calculations to Web Workers or debounce them.
- **Bundle size is monitored.** Large new dependencies require justification. Prefer smaller, focused libraries. Check bundlephobia before adding a dependency.

---

## 9. Linting & Formatting (The Full ESLint Config)

### Required ESLint Plugins

| Plugin | Purpose |
|--------|---------|
| `@typescript-eslint/eslint-plugin` | TypeScript-specific rules |
| `eslint-plugin-react` | React best practices |
| `eslint-plugin-react-hooks` | Rules of Hooks enforcement |
| `eslint-plugin-jsx-a11y` | Accessibility lint rules |
| `eslint-plugin-import` | Import/export conventions |
| `eslint-plugin-testing-library` | Testing Library best practices |
| `eslint-config-prettier` | Disables rules that conflict with Prettier |

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### CI Enforcement

- **Pre-commit hooks** (via `husky` + `lint-staged`): Run ESLint and Prettier on staged files.
- **CI pipeline** runs the full lint, type-check, and test suite on every PR. All three must pass before merge.
- **No `eslint-disable` without a comment explaining why.** Bare `eslint-disable` comments are treated as review blockers.

---

## 10. Git & PR Conventions

- **Conventional Commits** format: `type(scope): description`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`.
- **PRs must be focused.** One feature, one bug fix, or one refactor per PR. Don't mix concerns.
- **PRs must include tests** for any new behavior or bug fix. "Tests will be added later" is not accepted.
- **PR descriptions must explain the "why"**, not just the "what." AI agents must include context about the design decision, not just a summary of changed files.
- **No force-pushing to shared branches.** Rebase before push, don't rewrite shared history.

---

## Summary: The Quick Checklist

Before submitting any PR, verify:

- [ ] `npm run build` passes with zero errors (includes TypeScript type-check via `tsc`)
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run test` passes with adequate coverage
- [ ] No `any` types, no type assertions without comments
- [ ] Components use named exports, functional components, CSS Modules
- [ ] Tests query by role/label, test behavior not implementation, include a11y check
- [ ] New dependencies are justified (size checked, alternatives considered)
- [ ] Error states and edge cases are handled in both code and tests
- [ ] All hardcoded values use design tokens
- [ ] PR description explains the reasoning
