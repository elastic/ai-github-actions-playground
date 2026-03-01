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

When a change affects the visual appearance of the dashboard, you **must** capture and attach before/after screenshots to the pull request.

**Important:** Screenshots must show the feature you are building or modifying — not the default connections page. After starting the dev server, navigate to the relevant page or route that demonstrates your change before capturing the screenshot. If your change requires an Elasticsearch connection to be visible, describe the change in the PR body instead of attaching a screenshot of the connections page.

1. Start the dev server in the background and wait until it is ready:

```bash
cd peek && npm run dev &
DEV_PID=$!
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3000/ai-github-actions-playground/ >/dev/null && break; sleep 1; done
```

2. Run the screenshot preflight, passing `--url` with the route that shows your feature (not the default connections page):

```bash
cd peek && node scripts/screenshot-preflight.mjs --url http://127.0.0.1:3000/<feature-route> --output screenshot-preflight.json --screenshot screenshot.png
```

3. Stop the dev server:

```bash
kill $DEV_PID
```

4. If the preflight reports errors, attach the diagnostics JSON instead. If it passes, attach the captured screenshot to the PR body.

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
