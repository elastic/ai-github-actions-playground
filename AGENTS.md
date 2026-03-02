# Elastic Peek

@README.md
@DEVELOPING.md — includes engineering and accessibility standards that all contributions must follow
@CONTRIBUTING.md

## Automation Runtime

Runs are executed in non-interactive CI and state is ephemeral between runs.
Persist outcomes through safe outputs (comments/issues/PRs), because uncaptured local state is lost after the run.

## Application

See ./peek

## Environment Setup

**Before running any build, lint, or test command**, you must install dependencies. This is a Node.js project — nothing works without `node_modules`.

```bash
cd peek && npm ci   # install dependencies from lockfile (fast, deterministic)
```

Always run this first. Do not use `npm install` — use `npm ci` which is faster in CI because it skips dependency resolution and installs exactly what the lockfile specifies.

## Common Commands

```bash
make lint    # Prettier + ESLint on changed files + full TypeScript type check (override: make lint BASE=HEAD~3)
make lint-full # Prettier + ESLint + TypeScript type check on all files
make build   # production build (runs tsc + vite build)
make serve   # start dev server
make format  # auto-format changed files with Prettier (override: make format BASE=HEAD~3)
make format-full # auto-format all files with Prettier
make check   # lint + unit tests + build (equivalent to CI)
```

## Playwright (Screenshots & E2E Testing)

Playwright is available for navigating the app, taking screenshots, and capturing console errors.

### Interactive Browser Automation (MCP Tools)

Exploratory testing agents use **Playwright MCP tools** for interactive browser
automation. This is configured via `.gemini/settings.json` and provides tools
like `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`,
and `browser_take_screenshot`.

**Do NOT write Node.js scripts to drive the browser** — use the MCP tools
directly for step-by-step interactive exploration. This allows you to see
the page state after each action and adapt based on what you find.

After `make setup`, install the Chromium browser binary:

```bash
cd peek && npx playwright install chromium
```

### Taking Screenshots of Features

**Important:** The app requires connecting to an Elasticsearch cluster before any feature
pages are visible. A screenshot taken at the root URL will always show the
"Connect to Elasticsearch" landing page — not the feature you want to capture.

To take a screenshot of a specific feature page, use `screenshot-feature.mjs`.
It starts a dev server, mocks all required Elasticsearch endpoints, connects the
app automatically, navigates to the requested page, and saves a full-page screenshot.

```bash
cd peek && npx vite --port 3000 --host 127.0.0.1 &
DEV_PID=$!
sleep 5  # wait for server to be ready

# Replace "metrics" with the page you want to capture.
# Supported pages: cluster-overview | data-streams | indices | ingest-pipelines |
#                  query-lab | metrics | traces | console | users | roles |
#                  dashboards | fleet
node peek/scripts/screenshot-feature.mjs \
  --url http://127.0.0.1:3000/ai-github-actions-playground/ \
  --page metrics \
  --screenshot screenshot-metrics.png \
  --output screenshot-feature.json

kill $DEV_PID
```

### Diagnostics Preflight

The preflight script is a **diagnostics tool** — it navigates to the URL provided via --url
and checks for console errors, page errors, and
UI alert components. Use it to verify the app loads cleanly, not to demonstrate
features.

```bash
cd peek && npx vite --port 3000 --host 127.0.0.1 &
DEV_PID=$!
sleep 5  # wait for server to be ready

node peek/scripts/screenshot-preflight.mjs \
  --url http://127.0.0.1:3000/ai-github-actions-playground/ \
  --output screenshot-preflight.json \
  --screenshot screenshot.png

kill $DEV_PID
```

The preflight script writes a JSON diagnostics file with any console errors,
page errors, or UI-level error alerts. Known benign errors (e.g. Google Fonts
DNS failures in sandboxed CI) are automatically ignored.

### Running E2E Tests

```bash
make test-e2e   # starts the dev server automatically via Playwright config
```

E2E tests live in `peek/tests/e2e/` and run against Chromium.
The Playwright config (`peek/playwright.config.ts`) auto-starts the Vite dev server.

### Verifying Changes Against Real Elasticsearch Data

See DEVELOPING.md § OTLP Fixture Capture & Replay for full replay commands, data tables, and teardown instructions.

**Quick start (one-liner):**

```bash
# Start ES + collector, replay OTLP fixtures + seed app data, run live tests
make otel-replay-up && make otel-replay && make test-e2e-live
# Stop when done
make otel-replay-down
```

### Exploratory Testing Agents

See DEVELOPING.md § Exploratory Testing Agents for the full agent list, domains, and failure-handling rules.

### Visual Quality Checklist

Every exploratory agent MUST check these visual quality dimensions on pages
it visits. These are the exact defect patterns found in the February 2026
full-app audit (issue #872).

**Element height consistency in toolbars** — See DESIGN_LANGUAGE.md § Component Heights — a mismatch >4px is a bug. Measure using `browser_console_execute`:

```javascript
(() => {
  const els = document.querySelectorAll('input, button, [role="combobox"], [role="button"]');
  return JSON.stringify(Array.from(els)
    .map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, h: Math.round(r.height), top: Math.round(r.top), text: el.textContent?.trim().slice(0, 20) };
    })
    .filter(el => el.top > 50 && el.top < 250));
})()
```

**text.secondary contrast on dark mode** — See DESIGN_LANGUAGE.md § Brand Palette for the `text.secondary` minimum.
Check: sidebar section headers ("WORKSPACE", "SYSTEM", "HELP"), metric card
subtitle labels, table column headers, empty state helper text, and fieldset
`<legend>` elements. Switch to dark mode via Settings gear and take a
screenshot.

**Empty state consistency** — See DESIGN_LANGUAGE.md § Empty States for required anatomy.
Pages to verify: Query Lab, Metrics, Traces,
Dashboards, Fleet, Indices, Ingest Pipelines.

**Fieldset and legend visibility** — MUI `<fieldset>` borders with `<legend>`
labels must be fully visible. Legend text must not be clipped or render with
near-invisible contrast against the border.

**Metric card label readability** — Stat cards (Cluster Overview, Fleet, Cluster
Health) must show labels at sufficient size and contrast. Values must be
clearly larger than labels.

**axe-core color-contrast** — The love-audit now runs axe-core with
`color-contrast` enabled. Every violation is a genuine defect.

### UI Smoke Test PR Review

`ui-smoke-test-pr-review.yml` runs on every non-draft pull request that touches
`peek/**` or `Makefile`. It executes the full E2E smoke suite, runs the
screenshot preflight, and posts (or updates) a structured PR comment with:

- Per-test pass/fail status and durations
- Console errors, page errors, and UI alert diagnostics
- Actionable recommendations

Artifacts (screenshots, JSON diagnostics, Playwright traces) are uploaded to the
workflow run for deeper inspection.

Use the workflow specs under `.github/workflows/`.
