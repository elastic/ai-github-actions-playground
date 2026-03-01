# Contributing to Elastic Peek

Thank you for your interest in contributing! We welcome contributions from the community.

⚠️ **IMPORTANT**: This project uses agentic development. Contributions are made through issues, not direct pull requests.

🚫 **Direct Pull Requests Are Not Accepted**: You cannot create pull requests directly. Instead, create a detailed issue describing the change, and an AI agent will implement and submit the PR after maintainer approval.

## Why Agentic Development?

This project lives in the [ai-github-actions-playground](https://github.com/elastic/ai-github-actions-playground) repository, which serves as a testbed for Elastic's AI-powered GitHub workflows.

- **Dogfooding**: The repository uses AI GitHub Actions to build and maintain itself
- **Consistency**: All changes go through the same automated quality gates
- **Accessibility**: No local development environment is required to contribute

## How to Contribute

### 1. Research with an Agent

Before filing an issue, use an AI assistant to research the problem or feature. For bugs, have the agent identify root causes. For features, have it analyze the codebase and suggest an implementation approach.

**Issues submitted without agent analysis are likely to be deprioritized.**

### 2. Open an Issue with a Plan

Create an issue with: analysis of the problem/feature, step-by-step implementation plan naming specific files and components, and verification steps (`make check`).

### 3. Maintainer Assigns an Agent

Once approved, a maintainer assigns the issue to an AI agent. The agent creates a PR, implements your plan, runs validation, and responds to review feedback until the PR is merged.

## Issue Guidelines

- **Bugs**: Include reproduction steps, expected vs actual behavior, and proposed fix
- **Features**: Explain the use case, provide examples, and include step-by-step instructions
- **Be specific**: Name the files, components, and test cases the agent should touch

## Accessibility

All PRs are gated by an automated axe accessibility check in CI. The Playwright smoke suite runs axe scans on key pages — any new violation will fail CI.

- **Component tests**: Use `renderWithA11y` from `peek/tests/helpers/renderWithA11y.tsx` to include an axe check in new component test suites
- **E2E tests**: The smoke spec (`peek/tests/e2e/smoke.spec.ts`) runs axe on every core page automatically

## Documentation Updates

Feature and UX changes should include matching documentation updates in `peek/src/docs/` for user-facing behavior changes.

Before filing or reviewing a feature issue, verify whether an in-product docs section exists for the surface being changed (for example Query Lab, Metrics, Console, Data Streams, Chat, or Settings).

Use [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) for required structure, writing style, and review expectations.

## Security

If you discover a security vulnerability, please use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) — **do not** open a public issue.

## Further Reading

- [Development guide](DEVELOPING.md)
- [README](README.md)
