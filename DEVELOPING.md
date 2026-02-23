# Development Guide

## Repository Structure

| Directory | What |
| --- | --- |
| `peek/` | Vite + React 18 + TypeScript frontend application |
| `peek/src/components/` | React UI components (panels, editors, dialogs) |
| `peek/src/components/visualizations/` | Chart and table visualization components |
| `peek/src/dashboards/` | Default dashboard definitions |
| `peek/src/docs/` | Embedded in-product documentation content |
| `peek/src/schemas.ts` | Zod validation schemas for import/export |
| `peek/src/services/` | Elasticsearch ES|QL client |
| `peek/src/store/` | Zustand state management |
| `peek/tests/unit/` | Unit tests (Vitest + jsdom) |
| `peek/tests/integration/` | Integration tests (Testcontainers + Elasticsearch) |
| `docker/` | nginx config template for the Docker proxy image |
| `.github/workflows/` | GitHub Actions workflows (CI, GitHub Pages deployment) |

## Quick Start

```bash
make setup        # install Node.js dependencies (run this first)
make serve        # install deps + start Vite dev server with hot reload
make serve-proxy  # install deps + start dev server with Elasticsearch proxy (set ES_URL)
make build        # production build to peek/dist/
make lint         # Prettier + ESLint + TypeScript type checking
make format       # auto-format code with Prettier
make check        # run all checks then build (equivalent to CI)
make docker-build # build the Docker image (proxy + dashboard)
make docker-run   # run the Docker container (set ES_URL)
make otel-harness-up   # start local Elasticsearch + OTel host metrics harness
make otel-harness-logs # tail logs from the already-running harness started by otel-harness-up
make otel-harness-down # stop and remove OTel host metrics harness
```

> **Note:** `make serve` and `make serve-proxy` auto-install dependencies. The other targets (`lint`, `format`, `build`, `test-*`) assume dependencies are already installed — run `make setup` once first.

> **Pre-commit hook:** `make setup` (or `npm install` inside `peek/`) also installs a [husky](https://typicode.github.io/husky/) pre-commit hook that automatically runs Prettier (format) and ESLint (lint) on staged files via [lint-staged](https://github.com/lint-staged/lint-staged). This keeps committed code consistently formatted and lint-free.

## Running with a Proxy

Use `make serve-proxy` (or `ES_URL=... npm run dev` in the `peek/` directory) to start the Vite dev server with a built-in proxy. The proxy forwards requests to your Elasticsearch cluster, so no CORS configuration is needed on Elasticsearch.

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

Then enter `http://localhost:3000/_es` as the Elasticsearch URL when connecting the dashboard. The `/_es` prefix proxies all Elasticsearch API requests (connection validation, cluster health, queries, data streams, field caps, API console, etc.) to `ES_URL`.

```
┌─────────────┐    /_es/*       ┌──────────────────┐    /*             ┌────────────────────┐
│   Browser    │ ─────────────▶  │  Vite dev server  │ ─────────────▶  │   Elasticsearch    │
│              │ ◀─────────────  │  (localhost:3000) │ ◀─────────────  │   cluster          │
└─────────────┘    JSON          └──────────────────┘    JSON          └────────────────────┘
```

> **Legacy path:** The `/_query` path is also proxied directly for backward compatibility with ES|QL-only workflows.

## Architecture

The dashboard is a static single-page application. Elasticsearch queries are made directly from the browser, or via a local proxy that avoids CORS.

**Direct mode** (requires CORS on Elasticsearch):
```
┌─────────────┐    ES|QL     ┌────────────────────┐
│   Browser    │ ──────────▶  │   Elasticsearch    │
│  (static)    │ ◀──────────  │   cluster          │
└─────────────┘    JSON       └────────────────────┘
```

**Proxy mode** (no CORS required):
```
┌─────────────┐    /_es/*       ┌───────────┐    /*            ┌────────────────────┐
│   Browser    │ ─────────────▶  │   Proxy   │ ─────────────▶  │   Elasticsearch    │
│              │ ◀─────────────  │  (local)  │ ◀─────────────  │   cluster          │
└─────────────┘    JSON          └───────────┘    JSON          └────────────────────┘
```

### Key Design Decisions

- **No backend**: The site is fully static. The Elasticsearch URL is stored in `localStorage` for persistence, while API key/password are stored in `sessionStorage` and cleared when the tab session ends.
- **State persistence**: Dashboard state is persisted under the `elastic-peek` localStorage key via Zustand's `persist` middleware. Credentials are split into `sessionStorage` to limit exposure. If you rename the persist key, you must add a one-time migration that reads the old key and writes it to the new one — otherwise existing users lose their saved state.
- **Perses-aligned**: Uses the same charting engine (Apache ECharts) and UI framework (MUI) as Perses. The theme system and chart patterns follow Perses conventions.
- **ES|QL native**: Queries are written in ES|QL and sent directly to the `_query` endpoint. The response format (columnar JSON) is transformed into chart-compatible structures client-side.

## Adding a Visualization Type

1. Create a new component in `peek/src/components/visualizations/`
2. Add the type to the `VisualizationType` union in `peek/src/types.ts`
3. Register it in `peek/src/components/visualizations/Visualization.tsx`
4. Add the toggle option in `peek/src/components/PanelEditor.tsx`

## Docker

The `Dockerfile` produces a self-contained image that serves the built dashboard with nginx and proxies `/_query` to Elasticsearch. No CORS configuration on Elasticsearch is required.

```bash
make docker-build                              # build the image
make docker-run                                # run against host Elasticsearch (port 9200)
ES_URL=https://my-cluster:9200 make docker-run # run against a remote cluster
```

Or with Docker Compose:

```bash
ES_URL=http://my-elasticsearch:9200 docker compose up
```

Open `http://localhost:8080` and enter `http://localhost:8080/_es` as the Elasticsearch URL. The nginx proxy inside the container forwards `/_es` requests (with path rewriting) and `/_query` requests to `ES_URL`. See `docker/nginx.conf.template` for the proxy configuration.

## OTel Harness

Use this harness to generate real telemetry in local `metrics-*`, `traces-*`, and `logs-*` indices so query work can run against incoming data instead of seeded fixtures.

```bash
make otel-harness-up
```

This starts:
- Elasticsearch (`http://localhost:9200`)
- OpenTelemetry Collector (`hostmetrics` receiver + OTLP receiver + Elasticsearch exporter)
- otelgen traces generator (synthetic traces via OTLP)
- otelgen logs generator (synthetic logs via OTLP)
- Fleet agent simulator that writes representative Fleet documents to `fleet-agents-sim` for Cluster Overview testing

Stop it with:

```bash
make otel-harness-down
```

Optional:

```bash
make otel-harness-logs
```

Quick data check:

```bash
curl -s -X POST 'http://localhost:9200/_query' \
  -H 'Content-Type: application/json' \
  -d '{"query":"FROM metrics-hostmetricsreceiver-default | STATS count = COUNT(*) BY dataset = data_stream.dataset, metric_type = type | SORT count DESC"}'
```

## Testing

```bash
make test-unit        # fast, no Docker needed — primary CI gate
make test-integration # requires Docker (spins up Elasticsearch via Testcontainers)
make test-e2e         # Playwright browser tests (starts dev server automatically)
make test             # run all (unit, integration, e2e)
```

Unit tests (`peek/tests/unit/`) run in jsdom via Vitest. Integration tests (`peek/tests/integration/`) use [Testcontainers](https://testcontainers.com/) to start a real Elasticsearch instance, seed test data, and run ES|QL queries through the app's `executeEsql` service. **Docker must be running** for integration tests.

E2E tests (`peek/tests/e2e/`) use [Playwright](https://playwright.dev/) to launch a real browser against the Vite dev server. Playwright and the Chromium browser are installed as devDependencies — run `npx playwright install chromium` if the browser binary is missing.

To run E2E tests against live Elasticsearch data, start the OTel harness first:

```bash
make otel-harness-up                 # start Elasticsearch + OTel collector
ES_URL=http://localhost:9200 make test-e2e   # run e2e tests with proxy
make otel-harness-down               # stop when done
```

### Testing Philosophy

- **Test behavior, not implementation** — assert on what the user sees and what the system does, not internal wiring.
- **Fast by default** — all unit and component tests run in jsdom via Vitest with no browser, Docker, or network.
- **Component tests over E2E** — render real React components with `@testing-library/react` + `userEvent` to catch rendering bugs and interaction flows.
- **No trivial tests** — every test should describe a behavior someone cares about; skip "renders without crashing" tests with zero assertions.
- **Mock at boundaries** — mock `fetch`, `localStorage`, `echarts/core`; everything else uses real code paths.

### CI

`make ci` runs lint + unit tests + build on every push to `main` and on every PR that touches `peek/**`. Integration tests are not part of the default CI pipeline — run them locally with `make test-integration`.

Production builds (`make build`) output to `peek/dist/` and are deployed to GitHub Pages by the `deploy-pages.yml` workflow on every push to `main`.

## Engineering Standards

Many rules (no `any`, `import type`, import ordering, no duplicate imports) are enforced automatically by ESLint and TypeScript — see `peek/eslint.config.js` and `peek/tsconfig.json`. This section covers the design guidance that requires human judgment.

### TypeScript

- Prefer discriminated unions for state modeling (e.g., `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error }`) over optional fields.
- Prefer `interface` for object shapes and `type` for unions, intersections, and mapped types.

### React

- Prefer composition (children, render props, slots) over prop drilling. If a prop passes through a component that doesn't use it, restructure.
- Don't use `useEffect` to synchronize derived state — compute it during render instead.
- A component with more than 8 props or 200 lines is a code smell. Consider decomposing.

### State Management

Use the simplest solution that works, in this order: `useState` → derived state (compute during render) → `useReducer` → React Context → URL state → Zustand.

### Testing Standards

- Include at least one `vitest-axe` accessibility check per component test suite (`expect(await axe(container)).toHaveNoViolations()`).
- Test behavior (what the user sees), not implementation details (internal state, hook call counts).
- Test error states, loading states, and empty states — not just the happy path.

## Accessibility Standards

This project targets **WCAG 2.2 Level AA** conformance. Many structural issues (missing alt text, invalid ARIA, click without keyboard, missing labels) are caught by `eslint-plugin-jsx-a11y` and `vitest-axe`. This section covers what automation cannot catch.

### Color & Contrast

- 4.5:1 contrast ratio for normal text, 3:1 for large text (>= 18pt or >= 14pt bold), 3:1 for UI components and graphical objects.
- Never use color as the sole means of conveying information — add an icon, text, or pattern.

### Keyboard & Focus

- Every interactive element must be keyboard-operable (Tab to focus, Enter/Space to activate, Escape to dismiss overlays).
- No keyboard traps. Modal dialogs trap focus and provide Escape to close.
- Manage focus on route changes (move to main content or page heading) and dialog open/close (return focus to the trigger element).

### Semantic HTML & ARIA

- Use correct elements: `<button>` for actions, `<a>` for navigation, never `<div onClick>`. Logical heading hierarchy, no skipped levels, one `<h1>` per page.
- Prefer native HTML semantics over ARIA. If ARIA is used, implement the full contract (e.g., `role="tablist"` requires `role="tab"` children with `aria-selected`, arrow key navigation, and linked `role="tabpanel"`).
- Use landmark regions (`<main>`, `<nav>`, `<header>`, `<footer>`).

### Forms

- Every form input needs a visible `<label>` (via `htmlFor`). Error messages linked to inputs via `aria-describedby`. Group related inputs with `<fieldset>` and `<legend>`.

### Motion

- Respect `prefers-reduced-motion` — reduce or remove animations when this media query matches.

## PR Checklist (UI Changes)

For any PR that modifies UI, verify the items that CI cannot check automatically:

- [ ] Interactive elements are keyboard accessible (tab, activate, dismiss)
- [ ] Color contrast meets the ratios above
- [ ] Color is not the sole indicator of meaning
- [ ] Focus is managed correctly on route changes and dialog open/close
- [ ] Loading, empty, and error states are handled and designed
- [ ] Heading hierarchy is logical (no skipped levels)
