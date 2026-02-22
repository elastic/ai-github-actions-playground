# Documentation Standards

This guide defines how Elastic Peek documentation should be written and maintained across repository docs and in-product docs.

## Scope

These standards apply to:

- Top-level documentation (`README.md`, `DEVELOPING.md`, `CONTRIBUTING.md`)
- In-product docs content (`peek/src/docs/*.md`)
- Feature and workflow changes that alter user behavior

## Required Documentation for Feature Changes

Any user-visible feature change should include one of the following in the same PR:

1. Update an existing in-product doc section in `peek/src/docs/`
2. Add a new section and register it in `peek/src/docs/sections.ts`
3. Add or update top-level docs when behavior impacts setup, operations, or contribution workflows

If no documentation update is needed, the PR description should explicitly state why.

## In-Product Docs Structure

Each file in `peek/src/docs/` should follow this pattern:

1. A single H1 title (`# Section Title`)
2. Short purpose statement in the first paragraph
3. Task-oriented workflow guidance (happy path first)
4. Troubleshooting or failure-path guidance
5. Practical next step or related navigation handoff

Keep sections scannable. Prefer short paragraphs with one idea each.

## Writing Style

- Use direct, action-oriented language ("Open Query Lab", "Click Save to Dashboard")
- Prefer concrete terms over abstract phrasing
- Explain the user goal before implementation detail
- Keep tone neutral and technical; avoid marketing language
- Use backticks for API paths, commands, and code-like tokens
- Avoid unexplained acronyms unless they are already standard in context

## Accuracy and Verification

- Verify statements against current code paths, UI labels, and commands
- Reference real page names used in the sidebar and dialogs
- Do not describe unreleased or speculative behavior
- Run relevant checks after docs + wiring updates (`make test-unit` at minimum when `sections.ts` changes)

## Registration and Navigation Rules

When adding a new in-product docs file:

1. Add the Markdown file in `peek/src/docs/`
2. Import it in `peek/src/docs/sections.ts`
3. Register it in the `sections` array with a stable ID
4. Verify it appears in the Docs sidebar and search

Prefer kebab-case IDs aligned with file names.

## Maintenance Checklist

Before merging documentation changes, confirm:

- Content matches the current product behavior
- New feature surfaces have docs coverage
- Existing docs are updated for renamed UI labels or flows
- README links still point to valid files
- No contradictory instructions remain across docs
