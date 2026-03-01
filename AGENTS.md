# Elastic Peek

@README.md
@DEVELOPING.md — includes engineering and accessibility standards that all contributions must follow
@CONTRIBUTING.md

## Automation Runtime

Runs are executed in non-interactive CI and state is ephemeral between runs.
Persist outcomes through safe outputs (comments/issues/PRs), because uncaptured local state is lost after the run.

## Application

See ./peek

## Common Commands

```bash
make setup   # install dependencies
make serve   # start dev server
make build   # production build
make lint    # Prettier + ESLint + TypeScript type checking
make format  # auto-format code with Prettier
make check   # run all checks then build (equivalent to CI)
```

## Playwright (Screenshots & E2E Testing)

Playwright is available for navigating the app, taking screenshots, and capturing console errors.
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

When implementing features or fixing bugs, you can verify your changes render
correctly against real OTel data (traces, metrics, logs) instead of just mocks.
This catches issues that only appear with real-world data shapes and volumes.

**Quick start (one-liner):**

```bash
# Start ES + collector, replay OTLP fixtures + seed app data, run live tests
make otel-replay-up && make otel-replay && make test-e2e-live
# Stop when done
make otel-replay-down
```

**What this gives you:**

| Data | Source | Indices created |
|------|--------|----------------|
| Traces (9-service distributed) | OTLP fixture replay | `traces-generic.otel-default` |
| Metrics (CPU, memory, disk) | OTLP fixture replay | `metrics-hostmetricsreceiver.otel-default` |
| Logs | OTLP fixture replay | `logs-generic.otel-default` |
| web_logs, orders | `seed-elasticsearch.mjs` | `web_logs`, `orders` |
| Ingest pipelines | `seed-elasticsearch.mjs` | `logs-parse-nginx`, `enrich-geoip`, `metrics-normalize` |

After replay, connect the dev server to the live cluster:

```bash
ES_URL=http://localhost:9200 make serve-proxy
# Then open http://localhost:3000 and connect to http://localhost:3000/_es
```

This is the same data the `smoke-live-es.yml` agent explores against.
Use `make otel-replay-down` to tear everything down when done.

### Exploratory Testing Agents

Seven scheduled agents creatively explore the app with Playwright. Each owns a
domain and invents novel interaction scenarios every run — they do NOT run
pre-written test suites. Deterministic E2E tests run in CI instead.

- `smoke-welcome-flow.yml` → **Explore: Connection & Onboarding** — connection dialog, auth tabs, disconnect/reconnect, keyboard nav
- `smoke-metrics-flow.yml` → **Explore: Metrics & Charts** — metric search, chart rendering, time ranges, state persistence
- `smoke-traces-flow.yml` → **Explore: Traces & Service Map** — span trees, service map, trace-to-query pivot, navigation
- `smoke-auth-tab-switch.yml` → **Explore: Query Lab & Console** — ES|QL queries, result tables, API Console, error handling
- `smoke-reset-visibility.yml` → **Explore: Indices, Data Streams & Pipelines** — table sorting, detail views, data management
- `smoke-live-es.yml` → **Explore: Live Elasticsearch** — real OTel data, full stack, all pages with real cluster
- `customer-complaints.yml` → **Customer: Feature Gap Review** — missing features, feature requests, comparison to Kibana/Grafana/Elasticvue

### Visual Quality Checklist

Every exploratory agent MUST check these visual quality dimensions on pages
it visits. These are the exact defect patterns found in the February 2026
full-app audit (issue #872).

**Element height consistency in toolbars** — All interactive controls in a
filter/toolbar row (text fields, selects, chips, buttons) must be the same
height. A mismatch of more than 4px is a bug. Measure programmatically:

```javascript
const heights = await page.evaluate(() => {
  const els = document.querySelectorAll('input, button, [role="combobox"], [role="button"]');
  return Array.from(els)
    .map(el => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, h: Math.round(r.height), top: Math.round(r.top), text: el.textContent?.trim().slice(0, 20) };
    })
    .filter(el => el.top > 50 && el.top < 250);
});
```

**text.secondary contrast on dark mode** — Elements using MUI
`color="text.secondary"` on dark backgrounds can fall below WCAG AA 4.5:1.
Check: sidebar section headers ("WORKSPACE", "SYSTEM", "HELP"), metric card
subtitle labels, table column headers, empty state helper text, and fieldset
`<legend>` elements. Switch to dark mode via Settings gear and take a
screenshot.

**Empty state consistency** — Every page that can show "no data" must display
a centered icon, a short bold title, and a one-line helper sentence. No page
should show a blank rectangle. Pages to verify: Query Lab, Metrics, Traces,
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
