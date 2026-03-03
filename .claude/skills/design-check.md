# /design-check — Audit Files Against Design Language

## When to Use

Use `/design-check` to audit component files for violations of the project's design language and custom ESLint rules. Useful before committing, after writing new UI code, or when reviewing a PR.

## What to Check

### Custom ESLint Rules (`eslint-plugin-peek`)

These rules are enforced by the pre-commit hook and CI. Knowing them prevents commit failures:

| Rule | Severity | What It Catches |
|------|----------|-----------------|
| `peek/no-hardcoded-colors` | error | Inline hex values in `sx` props — use theme tokens instead |
| `peek/consistent-typography-variants` | error | Disallowed Typography variants (e.g., `h4`) |
| `peek/no-direct-echarts-import` | error | Direct `import * as echarts` — use `EChartWrapper` |
| `peek/no-div-onclick` | error | `<Box onClick>` or `<div onClick>` — use `ButtonBase`, `Button`, `IconButton`, or `ListItemButton` |
| `peek/enforce-spacing-tokens` | error | MUI spacing values outside the approved set: `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6` |
| `peek/no-hardcoded-heights` | error | Hardcoded pixel heights for standard elements — use `COMPONENT_HEIGHTS` from `src/types/tokens.ts` |
| `peek/max-component-lines` | warn | Component files over 200 lines — consider decomposing |
| `peek/enforce-empty-state` | error | Empty-data branches without `<EmptyState>` component |
| `peek/no-circular-progress` | error | `<CircularProgress>` — use `<ContentSkeleton>` or `<LinearProgress>` |
| `peek/require-icon-button-aria-label` | error | `<IconButton>` without `aria-label` prop |

### Additional Enforced Rules

| Rule | What It Catches |
|------|-----------------|
| `import/order` | Import groups must be separated by blank lines (builtin, external, internal, parent, sibling, index) |
| `import/no-duplicates` | Duplicate import statements |
| `no-restricted-imports` | Barrel MUI imports (`@mui/material`) — use path imports (`@mui/material/Button`) |
| `no-restricted-imports` (components) | Direct `services/es/client` imports in components — use hooks or barrel |
| `mui/sort-sx-keys` | Unsorted keys in `sx` props (auto-fixable with `eslint --fix`) |
| `@typescript-eslint/consistent-type-imports` | Missing `import type` for type-only imports |

### DESIGN_LANGUAGE.md Visual Rules

- No drop shadows (`elevation={0}` only)
- No gradients on surfaces
- Status indicators use color + icon + text (never color alone)
- Cards use `border: 1, borderColor: 'divider'` (no shadows)
- Loading states use `ContentSkeleton` or `LinearProgress` (never `CircularProgress`)
- Empty states use `<EmptyState>` component with icon, heading, description

### Component Heights (`COMPONENT_HEIGHTS`)

Import from `src/types/tokens.ts`:

```typescript
import { COMPONENT_HEIGHTS } from "../../types/tokens";
// button: 36, buttonSmall: 28, input: 36, tableRow: 36,
// sidebarNavItem: 32, toolbarRow: 44, tab: 36, touchTarget: 44
```

## Workflow

1. Read the target file(s)
2. Check each rule from the tables above
3. Report violations with line numbers and suggested fixes
4. Optionally run `cd peek && npx eslint --no-error-on-unmatched-pattern <file>` to confirm

## Output Format

```
## Design Check: <filename>

### Violations
- **Line 42**: `peek/no-div-onclick` — `<Box onClick>` should be `<ButtonBase onClick>`
- **Line 57**: `peek/enforce-spacing-tokens` — `mr: 0.75` is not a valid token, use `mr: 1`

### Warnings
- **peek/max-component-lines** — 215 lines (limit: 200), consider splitting

### Clean
- No hardcoded colors
- No hardcoded heights
- Import order correct
```
