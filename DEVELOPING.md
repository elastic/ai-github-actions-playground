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

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (required by Vite 7)
- **npm** `>=10` (bundled with Node.js 20/22)
- **GNU Make** — pre-installed on macOS and most Linux distributions. On Windows, install via [Chocolatey](https://chocolatey.org/) (`choco install make`), [Scoop](https://scoop.sh/) (`scoop install make`), or use WSL.

Use a version manager such as [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to switch Node versions quickly. A `.nvmrc` file is included in this repo — run `nvm use` or `fnm use` at the repo root to activate the correct version automatically.

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
make otel-up           # start local ES + EDOT collector + telemetry generators
make otel-logs         # tail EDOT collector logs
make otel-down         # stop and remove local OTel stack
make otel-cloud-up     # send OTel data to a remote cluster (set ES_URL, ES_API_KEY)
```

> **Note:** `make serve` and `make serve-proxy` auto-install dependencies. The other targets (`lint`, `format`, `build`, `test-*`) assume dependencies are already installed — run `make setup` once first.

If `make` is unavailable, run the equivalent npm commands directly from the `peek/` directory:

```bash
cd peek
npm install        # install dependencies (replaces make setup)
npm run dev        # start dev server (replaces make serve)
npm run build      # production build (replaces make build)
npm run lint       # lint (replaces make lint)
npm run format     # format (replaces make format)
```

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
2. Add the type key to `VISUALIZATION_TYPES` in `peek/src/components/visualizations/vizRegistry.tsx`
3. Add a registry entry in the same file's `vizRegistryEntries` array

## Docker

The `Dockerfile` produces a self-contained image that serves the built dashboard with nginx and proxies `/_es/*` to Elasticsearch. No CORS configuration on Elasticsearch is required.

```bash
make docker-build                              # build the image
make docker-run                                # run against host Elasticsearch (port 9200)
ES_URL=https://my-cluster:9200 make docker-run # run against a remote cluster
```

Or with Docker Compose:

```bash
ES_URL=http://my-elasticsearch:9200 docker compose up
```

Open `http://localhost:8080` and enter `http://localhost:8080/_es` as the Elasticsearch URL. The nginx proxy inside the container forwards `/_es` requests (with path rewriting) to `ES_URL`. See `docker/nginx.conf.template` for the proxy configuration.

## OTel Telemetry Stack

Generate real telemetry in `metrics-*`, `traces-*`, and `logs-*` indices using an EDOT collector and synthetic generators.

### Local (with Elasticsearch)

```bash
make otel-up      # starts ES + EDOT collector + otelgen traces & logs
make otel-logs    # tail collector logs
make otel-down    # stop and remove everything
```

This starts:
- Elasticsearch (`http://localhost:9200`)
- EDOT collector (Elastic Agent in OTel mode — `hostmetrics` + OTLP receiver + ES exporter)
- otelgen traces generator (synthetic multi-service traces via OTLP)
- otelgen logs generator (synthetic logs via OTLP)
- Fleet agent simulator that writes representative Fleet documents to `fleet-agents-sim` for Cluster Overview testing

### Remote (Elastic Cloud or any ES endpoint)

```bash
ES_URL=https://my-cluster.es.cloud:443 ES_API_KEY=... make otel-cloud-up
make otel-cloud-logs
make otel-cloud-down
```

This starts only the EDOT collector and generators — no local Elasticsearch.

### Quick data check

```bash
curl -s -X POST 'http://localhost:9200/_query' \
  -H 'Content-Type: application/json' \
  -d '{"query":"FROM metrics-hostmetricsreceiver-default | STATS count = COUNT(*) BY dataset = data_stream.dataset, metric_type = type | SORT count DESC"}'
```

## Fleet Harness

Use this harness to run a real Fleet Server stack with enrolled Elastic Agents. This produces the actual Fleet and agent telemetry data streams that the Fleet page consumes.

```bash
make fleet-harness-up
```

This starts (allow 3-5 minutes for full initialization):

- Elasticsearch with security enabled (`http://localhost:9220`, user `elastic`, password `changeme`)
- Kibana with Fleet auto-configuration (`http://localhost:5601`)
- Fleet Server (`http://localhost:8220`)
- Two enrolled Elastic Agents (`agent-host-01`, `agent-host-02`)

Data streams produced:

- `metrics-fleet_server.agent_status-default` — aggregate agent counts
- `metrics-fleet_server.agent_versions-default` — agent count per version
- `logs-fleet_server.output_health-default` — output health
- `logs-elastic_agent-default` — agent logs
- `metrics-elastic_agent.*-default` — agent metrics (CPU, memory)

Connect Peek to `http://localhost:9220` with credentials `elastic` / `changeme`.

Stop with:

```bash
make fleet-harness-down
```

Tail Fleet Server logs:

```bash
make fleet-harness-logs
```

Quick data check:

```bash
curl -sf -u elastic:changeme \
  'http://localhost:9220/_cat/indices/metrics-fleet_server*,logs-fleet_server*,logs-elastic_agent*,metrics-elastic_agent*?v&h=index,docs.count,store.size'
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
make otel-up                                 # start ES + EDOT collector
ES_URL=http://localhost:9200 make test-e2e   # run e2e tests with proxy
make otel-down                               # stop when done
```

### Scheduled Playwright Smoke Agents

The smoke agent plan runs five scheduled checks, each mapped to one Playwright smoke scenario:

| Scenario | Playwright test (`peek/tests/e2e/smoke.spec.ts`) | Workflow spec |
| --- | --- | --- |
| Welcome onboarding entry flow | `onboarding user reaches the connect entrypoint from the welcome screen` | `github/workflows/smoke-welcome-flow.yml` |
| Metrics user path to chart-ready state | `metrics user connects, picks a metric, and gets a line chart-ready result` | `github/workflows/smoke-connection-dialog.yml` |
| Credential mode switching guardrail | `security-focused user validates auth tab switching before submitting credentials` | `github/workflows/smoke-auth-tab-switch.yml` |
| Traces investigation to Query Lab pivot | `traces user opens a trace and pivots from service map context into Query Lab` | `github/workflows/smoke-connect-button-enablement.yml` |
| Connection guardrail + reset recovery | `ops user confirms connection guardrails and can reset back to the landing state` | `github/workflows/smoke-reset-visibility.yml` |

Each scheduled workflow asks the audit agent to run only its assigned smoke test with Playwright and open an issue when it fails, including failing test output plus screenshot/preflight diagnostics where available.
Workflow files are placed in `github/workflows/` so maintainers can relocate them into `.github/workflows/`.

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
