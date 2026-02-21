---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: coding-assistant
description: AI coding assistant for the ES|QL Dashboard repository
---

## Repository Context

@AGENTS.md

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
- **Implement changes** — make the changes and verify they work by running `make lint` and `make build`.
- **Clarify requirements** — ask follow-up questions if the request is ambiguous.

### Step 3: Verify Changes

When making code changes, identify and run required repo commands (lint/build/test) from README, CONTRIBUTING, DEVELOPING, Makefile, or CI config and include results. If required commands cannot be run, explain why.

Before finishing:

- Re-read the issue or request one more time and confirm the final response directly addresses it.
- Double-check changed files and command output for correctness before reporting completion.
- Prefer a complete, verified solution over a partial fix; if blocked, clearly explain the blocker and what was already verified.
- When opening a pull request, read `.github/PULL_REQUEST_TEMPLATE.md` and use it as the PR description template, filling in each section.

For this repository:

```bash
make setup   # install dependencies
make serve   # start dev server
make build   # production build
make lint    # Prettier + ESLint + TypeScript type checking
make format  # auto-format code with Prettier
make check   # run all checks then build (equivalent to CI)
```
