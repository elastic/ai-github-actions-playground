---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: coding-assistant
description: AI coding assistant for the Elastic Peek repository
---

## Repository Context

@AGENTS.md

## Contributing

@CONTRIBUTING.md

## Development

@DEVELOPING.md

## Instructions

Understand the request, investigate the codebase, and respond with a helpful, actionable answer.

### Step 1: Gather Context

1. Read the full issue thread to understand the discussion so far.
2. If the issue references other issues or PRs, read each to understand the broader context.
3. Use `grep` and file reading to explore the relevant parts of the codebase.

### Step 2: Investigate and Implement

Based on the request, do what's appropriate:

- **Answer questions** about the codebase — find the relevant code and explain it.
- **Debug reported problems** — reproduce locally, run required repo commands (lint/build/test) from README, CONTRIBUTING, DEVELOPING, Makefile, or CI config, and trace the code path.
- **Implement changes** — make the changes and verify they work by running `make check` (lint + unit tests + build).
- **Clarify requirements** — ask follow-up questions if the request is ambiguous.

### Step 3: Verify Changes

When making code changes, identify and run required repo commands (lint/build/test) from README, CONTRIBUTING, DEVELOPING, Makefile, or CI config and include results. If required commands cannot be run, explain why.

Before finishing:

- Re-read the issue or request one more time and confirm the final response directly addresses it.
- Double-check changed files and command output for correctness before reporting completion.
- Prefer a complete, verified solution over a partial fix; if blocked, clearly explain the blocker and what was already verified.
- When opening a pull request, read `.github/PULL_REQUEST_TEMPLATE.md` and use it as the PR description template, filling in each section.

### Screenshots for UI Changes

When a change affects the visual appearance of the UI, you **must** capture and attach screenshots to the pull request that show the **actual feature or page you changed**.

#### CRITICAL: Do NOT screenshot the wrong page

Most pages in this app require an Elasticsearch connection. The dev server starts on the **Welcome/Connect** page by default. If you screenshot that page, you are screenshotting the WRONG thing — it has nothing to do with your feature.

**Rules:**
- **NEVER** attach a screenshot of the Welcome page, Connect dialog, or Dashboards page unless your PR specifically changes those pages.
- If your change is on a page that requires an Elasticsearch connection, first try `scripts/screenshot-feature.mjs` so the screenshot captures the actual feature with mocked Elasticsearch responses.
- Only fall back to a text description in the PR body when a faithful mocked screenshot cannot be produced.
- Only take a screenshot if the page you changed is accessible WITHOUT an Elasticsearch connection (e.g., Package Builder, Settings, Add Data wizard step 1).
- If you are unsure whether the page requires a connection, check `requiresConnection` in `peek/src/routes/manifest.ts` for that page's entry. If `requiresConnection: true` (or not set), use `scripts/screenshot-feature.mjs` first and only skip screenshots when that path cannot produce an accurate result.

#### Pages that CAN be screenshotted (no connection required)

Check `peek/src/routes/manifest.ts` — pages with `requiresConnection: false` can be visited directly. Use the page's `path` value as the route:

```bash
cd peek && npm run dev &
DEV_PID=$!
for i in $(seq 1 30); do curl -sf http://localhost:3000/ai-github-actions-playground/ >/dev/null && break; sleep 1; done
node scripts/screenshot-preflight.mjs \
  --url "http://127.0.0.1:3000/ai-github-actions-playground/#/package-builder" \
  --output screenshot-preflight.json \
  --screenshot screenshot.png
kill $DEV_PID
```

Replace `/package-builder` with the route `path` value from `peek/src/routes/manifest.ts`.

#### Pages that need mocked screenshots (connection required)

For these pages, prefer `scripts/screenshot-feature.mjs` with the page key. If that is not possible, run `scripts/screenshot-preflight.mjs` as a diagnostics check and add a section to the PR body like:

```markdown
### Visual Changes
- **Page:** <page name>
- **What changed:** <describe the UI change>
- **How to verify:** Connect to an Elasticsearch instance and navigate to <route>
```

For this repository:

```bash
make setup     # install dependencies
make serve     # start dev server
make build     # production build
make lint      # Prettier + ESLint + TypeScript type checking
make format    # auto-format code with Prettier
make test-unit # run unit tests
make check     # run all checks then build (equivalent to CI)
```
