# Front-End Engineering Standards for React + TypeScript

**Repository:** `elastic/ai-github-actions-playground`

These two standards documents establish enforceable, opinionated conventions for a React + TypeScript application where **AI coding agents are the primary contributors**. Every recommendation prioritizes automation-first enforcement — if a rule can't be checked by a linter, type checker, or CI pipeline, it's explicitly marked as requiring manual review. The standards draw from Vercel, Shopify, Google, and Airbnb's published guides, adapted for the current React ecosystem (React 19, TypeScript 5.x, ESLint 9 flat config, Vitest, and React Compiler).

---

# Document 1: UX, Usability & Accessibility Standards

**Bottom line: approximately 57% of real-world accessibility issues can be caught by automated tooling**, but achieving WCAG 2.2 AA compliance requires a layered strategy combining static analysis, component tests, e2e tests, and structured manual review. This document specifies exactly what to automate, what tools to use, and what requires human judgment.

---

## WCAG 2.2 AA compliance: what's required and what's new

WCAG 2.2, published October 2023, contains **86 total success criteria**. AA conformance requires meeting all Level A and Level AA criteria — roughly **55 success criteria**. Six new criteria were added at the A/AA level that teams must now address.

The new AA-relevant success criteria demand attention because most existing codebases were built against WCAG 2.1:

| Success Criterion | Level | What It Requires |
|---|---|---|
| **2.4.11** Focus Not Obscured (Minimum) | AA | Focused elements must not be entirely hidden by sticky headers, cookie banners, or floating panels |
| **2.5.7** Dragging Movements | AA | All drag-based functionality must have a single-pointer alternative — no dragging required |
| **2.5.8** Target Size (Minimum) | AA | Interactive targets must be **≥24×24 CSS pixels**, or spaced so 24px-diameter circles around them don't overlap |
| **3.3.8** Accessible Authentication (Minimum) | AA | No cognitive function tests (CAPTCHAs) for authentication unless alternatives exist |
| **3.2.6** Consistent Help | A | Help mechanisms must appear in the same relative location across pages |
| **3.3.7** Redundant Entry | A | Don't force users to re-enter information already provided in the same session |

SC 4.1.1 (Parsing) was **removed** from WCAG 2.2 — assistive technologies no longer parse raw HTML.

### Automatable vs manual WCAG criteria

Deque's large-scale 2021 study using axe-core is the definitive data source. The critical distinction: **~30% of WCAG success criteria** are partially testable by automation, but because common issues like color contrast appear at very high frequency, **57% of actual accessibility issues by volume** are caught automatically. The remaining 43% require human judgment — keyboard navigation flows, screen reader behavior, cognitive load, content clarity, and meaningful alt text quality.

| What Can Be Automated | What Requires Manual Testing |
|---|---|
| Missing alt text (presence, not quality) | Alt text quality and appropriateness |
| Color contrast ratios (in real browsers, not JSDOM) | Color meaning conveyed only by color |
| Missing form labels | Form flow logic and error recovery UX |
| Invalid ARIA attributes/roles | Screen reader announcement order and clarity |
| Missing lang attribute | Keyboard navigation flow design |
| Heading structure (presence, not logic) | Heading hierarchy logical correctness |
| Empty links/buttons | Focus management after dynamic actions |
| Positive tabindex values | Cognitive load and reading comprehension |
| Interactive elements without keyboard handlers | Dragging alternatives (2.5.7) |
| Redundant ARIA roles | Authentication alternatives (3.3.8) |

**The 57% figure is a ceiling, not a floor.** axe-core catches 83% of contrast issues (which account for ~30% of all issues), inflating the overall percentage. For criteria like content reflow, timing adjustments, and cognitive patterns, automation coverage is near zero.

---

## The five-layer accessibility testing stack

Each layer catches different categories of issues. All five are required for genuine WCAG 2.2 AA conformance.

### Layer 1: Static analysis with eslint-plugin-jsx-a11y

**Package:** `eslint-plugin-jsx-a11y` v6.10+ — 36 rules that check JSX at lint time, before code runs. This is the cheapest, fastest layer. Use the `strict` preset for maximum coverage.

Key rules and what they enforce:

- **`alt-text`** → SC 1.1.1: Missing alt on `<img>`, `<area>`, `<input type="image">`
- **`click-events-have-key-events`** → SC 2.1.1: Clickable elements must have keyboard handlers
- **`label-has-associated-control`** → SC 1.3.1: Form labels properly associated with controls
- **`no-static-element-interactions`** → SC 4.1.2: No event handlers on `<div>` or `<span>` without roles
- **`prefer-tag-over-role`** → First Rule of ARIA: Prefer `<button>` over `<div role="button">`
- **`tabindex-no-positive`** → SC 2.4.3: No positive tabindex (breaks natural tab order)
- **`interactive-supports-focus`** → SC 2.1.1: Interactive elements must be focusable
- **`heading-has-content`** → SC 2.4.6: Headings must have visible text

**What it cannot catch:** Color contrast, actual keyboard navigation, screen reader behavior, focus management, target size, dynamic state changes, content reflow, or authentication patterns.

ESLint flat config integration:
```js
import jsxA11y from 'eslint-plugin-jsx-a11y';
export default [
  jsxA11y.flatConfigs.strict,
  {
    settings: {
      'jsx-a11y': {
        polymorphicPropName: 'as',
        components: { Button: 'button', Link: 'a', Image: 'img' },
      },
    },
  },
];
```

### Layer 2: Component tests with vitest-axe

**Package:** `vitest-axe` (Vitest) or `jest-axe` (Jest) — runs axe-core against rendered component DOM in JSDOM. **Critical limitation: color contrast checks do not work in JSDOM** because there's no real CSS rendering engine.

```ts
// vitest-setup.ts
import 'vitest-axe/extend-expect';

// Component test
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

it('LoginForm has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Every component should have at minimum one axe test. Configure the `region` rule to be disabled for isolated component tests (components aren't wrapped in landmarks during unit testing).

### Layer 3: Storybook addon-a11y for design review

**Package:** `@storybook/addon-a11y` — runs axe-core against rendered Storybook stories in a real browser. Unlike JSDOM-based tests, this catches color contrast violations. Integrate with the Storybook test runner for CI enforcement:

```js
// .storybook/test-runner.js
const { injectAxe, checkA11y } = require('axe-playwright');
module.exports = {
  async preVisit(page) { await injectAxe(page); },
  async postVisit(page) {
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  },
};
```

### Layer 4: E2E accessibility tests with Playwright + axe-core

**Package:** `@axe-core/playwright` — the most comprehensive automated layer. Runs in a real browser with real CSS rendering, catching contrast issues and layout-dependent violations that JSDOM misses.

```ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type A11yFixtures = { makeAxeBuilder: () => AxeBuilder };

export const test = base.extend<A11yFixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    );
  },
});

test('homepage passes WCAG 2.2 AA checks', async ({ page, makeAxeBuilder }) => {
  await page.goto('/');
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});
```

Best practices for Playwright accessibility tests:

- **Test after interactions**, not just page load — open modals, expand dropdowns, trigger error states, then run axe
- **Test multiple viewport sizes** — responsive layouts can introduce new violations at mobile breakpoints
- **Test both themes** separately if the app has light/dark mode
- **Use `.include()` scoping** for component-specific checks after dynamic interactions
- **Run in CI on every PR** as a required status check

### Layer 5: Lighthouse CI for score-based gating

**Package:** `@lhci/cli` v0.15+ — gates deployments on accessibility scores. A Lighthouse accessibility score of 100 means all automatable checks pass, but **Lighthouse 100 ≠ WCAG compliant**. Use it as a regression detector, not a compliance certificate.

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "color-contrast": "error",
        "image-alt": "error",
        "label": "error"
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

---

## Color contrast enforcement strategy

WCAG AA requires **4.5:1** contrast for normal text (<18pt), **3:1** for large text (≥18pt or ≥14pt bold), and **3:1** for UI components and graphical objects (SC 1.4.11). Focus indicators also need **3:1** contrast.

The enforcement strategy operates at three levels. At the **design system level**, define color tokens with pre-validated contrast pairs — every foreground/background combination in the token system must meet AA ratios before it enters the codebase. At the **lint level**, use Stylelint custom rules to ban raw hex/RGB values and enforce design token usage (this prevents developers from introducing untested color combinations). At the **test level**, rely on `@axe-core/playwright` in E2E tests — axe-core catches **83% of contrast issues** in real browser rendering. The JSDOM limitation makes this the only reliable automated contrast check.

Tools for verification: Chrome DevTools built-in contrast checker (Elements panel, color swatches), WebAIM Contrast Checker (webaim.org), Colour Contrast Analyser by TPGi (desktop app with eyedropper), and Figma plugins (Stark, A11y Color Contrast Checker) for design-time checking.

---

## Semantic HTML requirements for React components

The W3C's First Rule of ARIA applies universally: **if you can use a native HTML element with the behavior you need built in, use it**. The codebase must follow these semantic standards:

**Landmarks:** Every page must have exactly one `<main>`, a `<header>` for the site banner, `<nav>` for navigation (labeled with `aria-label` when multiple navs exist), `<footer>` for site-wide footer content, and `<aside>` for complementary content. These elements automatically expose landmark roles to assistive technology — do not add redundant `role` attributes.

**Headings:** One `<h1>` per page. Headings must not skip levels (no jumping from `<h1>` to `<h3>`). Screen readers use headings to build a navigable table of contents. Every page must include a "Skip to content" link as the first focusable element, targeting `<main>` with `tabindex="-1"`.

**Interactive elements:** Use `<button>` for actions (opening modals, submitting forms, toggling states). Use `<a>` for navigation (changing URLs). Never use `<div>` or `<span>` with click handlers for interactive purposes. Icon-only buttons require `aria-label` with a descriptive name.

**Forms:** Every form control must have an associated `<label>` (via `htmlFor` in React). Use `<fieldset>` and `<legend>` for radio/checkbox groups. Never disable paste on inputs. On form submission errors, focus the first error field. Prefer inline validation that announces errors via `aria-live="polite"`.

**Lists and tables:** Use `<ul>`/`<ol>`/`<li>` for lists. Use `<table>`, `<thead>`, `<tbody>`, `<th scope="col|row">` for tabular data. Never simulate these structures with `<div>` elements.

---

## Focus management patterns

Focus management is the most commonly overlooked accessibility requirement and **cannot be automated** — it requires deliberate architectural decisions.

**Modal/dialog focus trapping** follows a strict protocol aligned with WAI-ARIA Authoring Practices: when a dialog opens, move focus to the first focusable element inside it (or the dialog container). Trap Tab/Shift+Tab within the modal so focus cycles through internal elements. Escape closes the dialog. On close, **restore focus to the triggering element**. Use `focus-trap-react` (most popular), React Aria's `Modal`/`Dialog` (built-in trapping), or Radix UI's Dialog component.

**Focus restoration after destructive actions:** When deleting an item from a list, move focus to the next item or a logical parent container. After form submission, focus the success message or the next logical action. Store trigger element references via `useRef` for reliable restoration.

**Tab order must match DOM order.** Never use positive `tabindex` values (1, 2, 3) — they override natural order and create maintenance problems. Use `tabindex="0"` to add non-interactive elements to the tab order, `tabindex="-1"` for programmatic-only focus. Prefer `:focus-visible` over `:focus` for visual indicators to avoid showing focus rings on mouse clicks.

---

## Responsive design requirements

Design mobile-first: base styles target mobile, then progressively enhance with `min-width` media queries. Over **60% of web traffic** comes from mobile devices.

| Breakpoint | Min-width | Purpose |
|---|---|---|
| `sm` (base) | 0px | Single column, stacked layout |
| `md` | 768px | Two-column layouts, expanded navigation |
| `lg` | 1024px | Multi-column with sidebar |
| `xl` | 1280px | Wide content, data-dense views |

Use CSS `clamp()` for fluid typography: `font-size: clamp(1rem, 1rem + 0.5vw, 1.5rem)`. Minimum body font is **16px** on mobile. Line length should stay between 45–75 characters for readability. Use container queries (stable in all browsers since late 2023) for component-level responsiveness — a card in a sidebar should behave differently than the same card in main content, independent of viewport width.

Touch targets must be at minimum **44×44 CSS pixels** on mobile (WCAG 2.5.5 Enhanced) and **24×24 CSS pixels** universally (WCAG 2.2 SC 2.5.8). Enforce this in Playwright tests by checking element bounding boxes.

---

## Nielsen's usability heuristics for React applications

Jakob Nielsen's 10 heuristics, now 30+ years old, remain the standard framework for usability evaluation. Adapted for modern React:

**Visibility of system status** means showing loading states via `Suspense` fallbacks and skeleton screens, providing instant feedback on form submissions through toast notifications, and using `useTransition` for non-blocking state updates with pending UI indicators. Never leave users wondering if an action worked.

**Match between system and real world** requires using domain language familiar to users, following established conventions (cart icon, heart for favorites), and displaying dates/times in the user's locale and timezone.

**User control and freedom** translates to supporting undo for destructive actions, providing clear cancel/back navigation, making modals dismissable via both Escape key and a visible close button, and implementing confirmation dialogs for irreversible operations.

**Consistency and standards** is enforced through a design system with consistent tokens for spacing, typography, and color. Tailwind's config-driven approach naturally enforces this — all spacing, colors, and typography come from a constrained set of design tokens.

**Error prevention** means inline real-time form validation (using React Hook Form + Zod), TypeScript-enforced type safety that eliminates categories of runtime errors, and confirmation steps before destructive actions. The best error message is the one that never appears.

**Recognition rather than recall** requires visible labels alongside icons (never icons alone), persistent navigation and breadcrumbs, autocomplete for search fields, and WCAG 3.3.7's prohibition on requiring users to re-enter previously-provided information.

**Flexibility and efficiency** maps to keyboard shortcuts for power users, multiple paths to accomplish tasks, and fully keyboard-navigable interfaces.

**Aesthetic and minimalist design** aligns directly with performance: less UI means less JavaScript means faster load times. Use progressive disclosure to show details on demand.

**Error recovery** means human-readable error messages (never stack traces), specific corrective suggestions, highlighting the field with the error, and automatic retry mechanisms for network failures.

**Help and documentation** translates to contextual tooltips, searchable documentation, onboarding flows, and WCAG 3.2.6's requirement that help mechanisms appear in consistent locations.

---

## Performance budgets that affect UX

Core Web Vitals are Google ranking factors and direct measures of user experience. The current thresholds (measured at the 75th percentile):

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | **≤2.5s** | 2.5–4.0s | >4.0s |
| **INP** (Interaction to Next Paint) | **≤200ms** | 200–500ms | >500ms |
| **CLS** (Cumulative Layout Shift) | **≤0.1** | 0.1–0.25 | >0.25 |

INP replaced FID in March 2024 as the official responsiveness metric. Only ~47% of websites meet all three "Good" thresholds.

Bundle size budgets directly impact these metrics. For initial load, target **≤300KB gzipped total JavaScript** and **≤170KB for the main bundle**. Per-route JavaScript chunks should stay **≤50–100KB gzipped**. Enforce these with `size-limit` in CI — it calculates real cost including download and execution time, and posts bundle size changes as PR comments.

---

## What percentage of accessibility can automation realistically catch

**The honest answer: about 30% of WCAG success criteria are partially testable, catching roughly 57% of issues by volume.** The gap exists because the most common issues (color contrast, missing alt text, missing form labels) happen to be automatable, while the most impactful issues (keyboard flows, screen reader experience, cognitive accessibility) are not.

For this repository specifically — where AI agents are the primary contributors — automation becomes even more critical because AI agents cannot perform manual testing. The strategy is: **automate everything possible, then create structured manual testing checklists for the remaining 43%**. Require manual accessibility review as a PR approval gate for any component that handles focus management, introduces new interactive patterns, or modifies navigation.

---
---

# Document 2: Front-End React/TypeScript Engineering Standards

**These standards are designed for enforcement by CI pipelines and AI coding agents.** Every rule is classified as either CI-enforced (MUST — the build fails if violated) or agent-guided (SHOULD — strongly recommended, verified in code review). Configuration snippets are production-ready.

---

## React component architecture: functional, composable, typed

All components are functional components with hooks. Class components are prohibited except for Error Boundaries (the sole remaining valid use case, as React has not yet provided a hooks-based error boundary API).

**Component composition is the primary abstraction mechanism**, not prop drilling. The hierarchy of preferred patterns:

1. **Children and render slots** — pass `ReactNode` as children or named props for layout composition
2. **Custom hooks** — extract shared stateful logic (one concern per hook, always prefixed with `use`)
3. **Compound components** — for complex UI elements sharing implicit state (Select + Select.Option, Tabs + Tab.Panel)
4. **Context** — for cross-cutting concerns that change infrequently (theme, auth, locale)
5. **External state management** — only when Context's re-render characteristics become a bottleneck

```tsx
// ✅ Composition: pass components as children/props
function Layout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="layout">
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

// ❌ Prop drilling: threading data through intermediate components
function App() {
  return <Parent theme={theme} user={user} locale={locale} /* 8 more props */ />;
}
```

**Error Boundaries** wrap every major route section. **Suspense boundaries** wrap every lazy-loaded component and data-fetching boundary. These should be paired:

```tsx
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<Skeleton />}>
    <LazyDashboard />
  </Suspense>
</ErrorBoundary>
```

**Server Components awareness:** Even for client-side SPAs, design components with clear data/UI separation, keep render functions pure (no side effects), and colocate data fetching in dedicated hooks or services. This positions the codebase for potential Server Components migration and satisfies React Compiler requirements.

### File and folder structure

Use **feature-based (domain-based) organization**, the 2025 consensus. Group by domain, not by file type:

```
src/
├── features/
│   ├── auth/
│   │   ├── components/LoginForm.tsx
│   │   ├── components/LoginForm.test.tsx
│   │   ├── hooks/useAuth.ts
│   │   ├── services/authService.ts
│   │   ├── types/auth.types.ts
│   │   └── index.ts              # barrel export
│   └── dashboard/
│       ├── components/
│       ├── hooks/
│       └── index.ts
├── shared/
│   ├── components/                # reusable UI primitives
│   ├── hooks/                     # shared custom hooks
│   ├── utils/                     # pure utility functions
│   └── types/                     # shared type definitions
├── app/                           # providers, routes, layout
└── config/                        # environment, constants
```

### Naming conventions

| Element | Convention | Example |
|---|---|---|
| Component files | PascalCase `.tsx` | `UserProfile.tsx` |
| Hook files | camelCase with `use` prefix `.ts` | `useAuth.ts` |
| Utility files | camelCase `.ts` | `formatDate.ts` |
| Type files | camelCase `.ts` | `auth.types.ts` |
| Test files | Match source with `.test` suffix | `UserProfile.test.tsx` |
| Components | PascalCase functions | `export function UserProfile()` |
| Props types | `{ComponentName}Props` | `type UserProfileProps = {}` |
| Event handlers | `handle{Event}` in component, `on{Event}` in props | `handleClick` / `onClick` |
| Boolean state | `is`/`has`/`should` prefix | `isLoading`, `hasError` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |

**Named exports only.** Default exports are banned per Google TypeScript Style Guide and Vercel's style guide — named exports ensure consistent import names, better refactoring support, and clearer error messages. Avoid `React.FC` — use direct props typing (`function Button({ label }: ButtonProps)`).

---

## TypeScript strictness: maximum safety, zero `any`

TypeScript `strict: true` is non-negotiable. The following `tsconfig.json` settings are required:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,    // array/record access may be undefined
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

**`any` is banned.** The `@typescript-eslint/no-explicit-any` rule is set to `error`. Use these alternatives:

- **Unknown input →** `unknown` (requires narrowing before use)
- **Generic containers →** Generics: `function process<T extends { name: string }>(data: T)`
- **Catch variables →** `unknown` (enabled by `useUnknownInCatchVariables` in strict mode)
- **Untyped third-party code →** Write declaration files or use `@ts-expect-error` with an explanatory comment

**Discriminated unions** are the TypeScript killer pattern for React — they make invalid states unrepresentable:

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

Use `type` for unions, intersections, and computed types. Use `interface` for object shapes that may be extended. No `I` prefix on interfaces (Hungarian notation is deprecated across Google, Vercel, and modern TypeScript community). Use `import type { }` for type-only imports (enforced by `@typescript-eslint/consistent-type-imports`).

---

## CSS and styling: Tailwind CSS primary, CSS Modules secondary

**Runtime CSS-in-JS is dead for new projects.** styled-components and Emotion add ~8–12KB bundle overhead, create 3 extra React components per styled element, conflict with React 18/19 streaming SSR, and produce nearly **2× rendering time** compared to static CSS (per Emotion maintainer Sam Magura's own benchmarks). The React team explicitly warned that injecting styles during render makes CSS-in-JS "very slow in concurrent rendering."

**Primary: Tailwind CSS.** It is the ecosystem standard, backed by Vercel, default in `create-next-app`, and used by Shopify's headless storefronts. Tailwind's config-driven design tokens enforce consistency, the JIT compiler ships only used classes (tiny production CSS), and v4's Rust-based engine dramatically improves build speed. Tailwind enforces Nielsen's "consistency and standards" heuristic by constraining all spacing, typography, and color to a defined system.

**Secondary: CSS Modules.** For complex component-specific styles where Tailwind utilities become unwieldy (complex animations, intricate pseudo-element layouts), use co-located `.module.css` files. CSS Modules have zero runtime cost, native Vite/Next.js support, and full CSS feature coverage.

**For design systems at scale:** Consider vanilla-extract (TypeScript-first tokens), StyleX (Meta's atomic CSS compiler), or Panda CSS (zero-runtime utility-first). These are specialized tools — Tailwind + CSS Modules covers 95% of needs.

---

## State management: the decision framework

State management in 2025 follows a clear decision tree. The most common mistake is reaching for a global state library before exhausting simpler options.

**Server/async data** uses TanStack Query (React Query) v5. Treat server data as a cache, not client state. TanStack Query handles caching, deduplication, background refetch, optimistic updates, and stale-while-revalidate automatically. Never store server responses in useState or Redux.

**Local component state** uses `useState` for simple values and `useReducer` for complex state where one update depends on another value, or when multiple actions modify state differently. The key decision criterion from the React community: "When one element of your state relies on the value of another element in order to update, use `useReducer`."

**Shared state across nearby components** is solved by lifting state up or composition — pass state down via props, pass update functions down via callbacks. This covers most cases.

**Low-frequency global state** (theme, locale, auth status, feature flags) uses React Context. Context re-renders all consumers on any change, so split contexts by domain and keep providers narrow.

**High-frequency or complex global state** uses Zustand as the default external state library. It's lightweight (~1KB), hook-based, requires no providers, supports selectors for granular re-rendering, and works with React DevTools. Jotai is the alternative for fine-grained, bottom-up atomic state patterns.

---

## Testing: what to test, how to test, and realistic coverage

### Testing philosophy

Follow Kent C. Dodds' Testing Trophy: heavy on **integration tests** (components rendered with user interactions and mocked APIs), moderate **unit tests** (pure functions, utilities, complex hooks), selective **e2e tests** (critical user flows only), and continuous **static analysis** (TypeScript + ESLint catching the broadest category of bugs).

### React Testing Library rules

Use `@testing-library/react` with `@testing-library/user-event` (never `fireEvent` — `userEvent` simulates real browser interactions). Always use `screen` for queries. Query priority is strict:

1. **`getByRole`** — default choice, tests accessibility simultaneously
2. **`getByLabelText`** — for form fields
3. **`getByText`** — for non-interactive content
4. **`getByTestId`** — escape hatch only, when semantic queries aren't possible

Anti-patterns that are banned: using `container.querySelector`, wrapping in unnecessary `act()`, using `waitFor` when `findBy*` works, testing implementation details (internal state, hook call counts), and excessive mocking.

Enforce these with `eslint-plugin-testing-library` and `eslint-plugin-jest-dom`.

### Coverage expectations

Target **70% line coverage** as the CI floor, with **60% branch coverage** minimum. These thresholds are realistic and useful — they catch regressions without incentivizing brittle tests that chase 100% by testing implementation details. The better question than "what's our coverage number?" is "can we refactor with confidence?"

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      thresholds: { statements: 70, branches: 60, functions: 70, lines: 70 },
    },
  },
});
```

**Vitest over Jest** for new projects. Vitest is 4–10× faster, has native TypeScript and ESM support, shares `vite.config.ts`, and is API-compatible with Jest. Migration from Jest is nearly trivial.

### Visual regression testing

Use **Chromatic** if Storybook is part of the workflow — it's maintained by the Storybook team, supports TurboSnap (reducing snapshots by ~85%), and includes unlimited parallelization. Playwright's native screenshot comparison has a critical cross-OS baseline mismatch problem (Mac screenshots differ from Linux CI screenshots). For budget-conscious teams, **Argos** or **Lost Pixel** are cost-effective alternatives to Percy/Chromatic.

---

## Performance patterns: let the compiler work

### React Compiler changes everything

React Compiler v1.0 (stable October 2025) automatically memoizes components, props, and values at build time. Meta's Quest Store saw **up to 12% faster initial loads and >2.5× faster interactions**. The practical implication: **stop writing `useMemo`, `useCallback`, and `React.memo` by default.**

For new code, write clean components without manual memoization — the compiler handles it. Keep manual memoization only for third-party library interop that requires identity-stable callbacks, or after profiling proves a specific hot path benefits. Prerequisites: render logic must be pure (no side effects, no mutations during render).

### Code splitting strategy

Route-based code splitting is mandatory — use `React.lazy` with `Suspense` for every route. Interaction-based splitting (modals, dropdowns, heavy visualizations) is strongly recommended for components that aren't needed on initial render. Don't over-split — too many micro-bundles create HTTP overhead. Use `webpack-bundle-analyzer` or `source-map-explorer` to identify genuine splitting candidates.

### Bundle analysis in CI

```json
{
  "size-limit": [
    { "path": "dist/assets/index-*.js", "limit": "170 kB" },
    { "path": "dist/assets/vendor-*.js", "limit": "80 kB" }
  ]
}
```

Use the `andresz1/size-limit-action` GitHub Action to post bundle size diffs as PR comments. This provides immediate visibility when a dependency or code change inflates the bundle.

---

## ESLint configuration: the complete flat config

ESLint 9+ uses flat config (`eslint.config.mjs`) as the standard. This configuration integrates all required plugins:

```js
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import testingLibrary from 'eslint-plugin-testing-library';
import jestDom from 'eslint-plugin-jest-dom';

export default [
  { ignores: ['dist/', 'build/', 'coverage/', '**/*.d.ts'] },

  eslint.configs.recommended,

  // TypeScript — strict + stylistic
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // React + Accessibility
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooksPlugin, 'jsx-a11y': jsxA11yPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.strict.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'error',
    },
  },

  // Import ordering
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import/no-duplicates': 'error',
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    extends: [testingLibrary.configs['flat/react'], jestDom.configs['flat/recommended']],
  },
];
```

### Required packages

```bash
npm install -D eslint typescript-eslint @eslint/js eslint-plugin-react \
  eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-import \
  eslint-plugin-testing-library eslint-plugin-jest-dom eslint-config-prettier
```

The `eslint-config-prettier` package goes last in the config chain — it disables all ESLint rules that conflict with Prettier. Do **not** use `eslint-plugin-prettier` (it's slower and creates noise). Run Prettier separately.

---

## Prettier: the canonical configuration

```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Every setting is deliberate: `printWidth: 80` keeps diffs small (Prettier's own recommendation). `singleQuote: true` is the dominant React/JS convention. `trailingComma: "all"` produces cleaner git diffs. `endOfLine: "lf"` prevents cross-platform issues. These are the most common settings across the React ecosystem and match Vercel's published style guide.

---

## CI/CD automation: the complete pipeline

This GitHub Actions workflow enforces every automatable standard:

```yaml
name: Frontend CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - name: TypeScript
        run: npx tsc --noEmit
      - name: ESLint
        run: npx eslint . --max-warnings 0
      - name: Prettier
        run: npx prettier --check .

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx vitest run --coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci && npm run build
      - name: Bundle size check
        run: npx size-limit

  lighthouse:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci && npm run build
      - uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true
          temporaryPublicStorage: true

  e2e-accessibility:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
```

### What each CI check enforces

| CI Check | Tool | What It Catches | Failure Mode |
|---|---|---|---|
| Type safety | `tsc --noEmit` | Type errors, missing properties, incorrect function signatures | Build fails |
| Code quality | ESLint `--max-warnings 0` | Style violations, accessibility issues, hooks misuse, banned patterns | Build fails |
| Formatting | `prettier --check` | Inconsistent formatting | Build fails |
| Tests + coverage | Vitest with thresholds | Regressions, logic errors, component behavior, accessibility (vitest-axe) | Build fails below 70% |
| Bundle size | size-limit | Bundle regressions, bloated dependencies | Build fails over budget |
| Performance | Lighthouse CI | LCP, CLS, INP regressions, accessibility score drops | Build fails below thresholds |
| E2E accessibility | Playwright + axe-core | Runtime accessibility violations in real browser | Build fails on violations |
| Visual regression | Chromatic (optional) | Unintended visual changes | PR blocked pending review |

---

## How to structure rules for AI coding agents

AI agents (Claude, Copilot, Cursor) follow rules most consistently when those rules are **explicit, scoped, example-driven, and enforceable**. Teams using well-structured AI rules report **40–60% fewer revision cycles**.

### CLAUDE.md for this repository

```markdown
# Project Guidelines — elastic/ai-github-actions-playground

## 0 — Core Principles
MUST rules are enforced by CI. SHOULD rules are verified in review.

## 1 — Component Standards
- **C-1 (MUST)** Functional components only. No class components except ErrorBoundary.
- **C-2 (MUST)** Named exports only. No default exports.
- **C-3 (MUST)** Props typed as `{ComponentName}Props`. No `React.FC`.
- **C-4 (MUST)** `import type { }` for type-only imports.
- **C-5 (SHOULD)** Prefer composition (children/slots) over prop drilling.
- **C-6 (SHOULD)** One component per file. Small helpers allowed in same file.

## 2 — TypeScript
- **TS-1 (MUST)** No `any`. Use `unknown`, generics, or proper types.
- **TS-2 (MUST)** Discriminated unions for state machines and variant props.
- **TS-3 (SHOULD)** Prefer `type` for unions/intersections, `interface` for extendable shapes.
- **TS-4 (SHOULD NOT)** Prefix interfaces with `I`.

## 3 — Styling
- **S-1 (MUST)** Use Tailwind CSS utilities for styling.
- **S-2 (SHOULD)** Use CSS Modules (.module.css) for complex component styles.
- **S-3 (MUST NOT)** Use runtime CSS-in-JS (styled-components, Emotion).

## 4 — Accessibility
- **A-1 (MUST)** Every `<img>` has meaningful alt text.
- **A-2 (MUST)** Interactive elements use `<button>` or `<a>`, never styled `<div>`.
- **A-3 (MUST)** Form controls have associated `<label>` elements.
- **A-4 (MUST)** Modals trap focus and restore on close.
- **A-5 (SHOULD)** Use semantic HTML landmarks (main, nav, header, footer).

## 5 — Testing
- **T-1 (MUST)** Colocate tests as `*.test.tsx` next to source.
- **T-2 (MUST)** Use `getByRole` as default query. `getByTestId` is escape hatch only.
- **T-3 (MUST)** Every component has at minimum one vitest-axe accessibility test.
- **T-4 (SHOULD)** Use `userEvent` over `fireEvent`.
- **T-5 (SHOULD)** Prefer integration tests over heavily mocked unit tests.

## 6 — File Structure
- Features in `src/features/{domain}/`
- Shared code in `src/shared/`
- Barrel exports via `index.ts` per feature

## 7 — CI Gates (all MUST pass)
- `tsc --noEmit` — zero type errors
- `eslint . --max-warnings 0` — zero warnings
- `prettier --check .` — consistent formatting
- `vitest run --coverage` — 70% line coverage minimum
- `size-limit` — bundle within budget
```

### Cursor rules (.cursor/rules/react.mdc)

```markdown
---
applyTo: "**/*.tsx"
description: "React component standards"
---

When creating or modifying React components:
- Use functional components with TypeScript props interface
- Export as named export: `export function ComponentName()`
- Props type: `type ComponentNameProps = { ... }`
- Use `getByRole` in tests, never `container.querySelector`
- Include vitest-axe test: `expect(await axe(container)).toHaveNoViolations()`
- Use Tailwind utilities for styling
- Use semantic HTML: `<button>` for actions, `<a>` for navigation
- Every interactive element must be keyboard accessible
```

The key insight for agent-friendly rules: **every rule should be verifiable**. If a rule says "prefer composition," the agent can't measure compliance. If it says "no default exports" or "every component has an axe test," the agent (and CI) can verify it definitively.

---

## Conclusion: automation-first, agent-compatible, rigorously typed

These standards are built around one organizing principle: **if AI agents are the primary contributors, every meaningful quality standard must either be enforced by CI or expressed as an unambiguous, verifiable rule.** The five CI gates (type checking, linting, formatting, testing with coverage, bundle budgets) catch the broadest class of issues automatically. The accessibility testing stack (eslint-plugin-jsx-a11y → vitest-axe → @axe-core/playwright → Lighthouse CI) covers roughly 57% of accessibility issues without human intervention. The remaining 43% — keyboard flows, screen reader behavior, cognitive accessibility — require structured manual review checklists attached to PRs that modify interactive components.

The strongest signal from industry leaders (Vercel, Google, Shopify) is convergence: **TypeScript strict mode, named exports, functional components, Tailwind CSS, Vitest, semantic HTML first, and React Compiler for automatic optimization**. These aren't trends — they're the settled consensus of the React ecosystem heading into 2026. Building on this foundation means the codebase stays maintainable whether the contributor is a human engineer or an AI agent.