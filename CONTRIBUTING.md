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

Create an issue with a clear, step-by-step implementation plan. The more detailed your plan, the better the agent can execute it.

**Example:**

```markdown
## Add heatmap visualization type

### Analysis
The dashboard currently supports time series, bar, pie, table, stat, and gauge
visualizations. A heatmap would be useful for visualizing density distributions
from ES|QL aggregations like STATS ... BY bucket1, bucket2.

### Implementation Plan

1. **Create HeatmapChart component** (`dashboard/src/components/visualizations/HeatmapChart.tsx`):
   - Accept EsqlResponse data
   - Map two categorical columns to x/y axes and a numeric column to color intensity
   - Use ECharts heatmap series type

2. **Register the visualization**:
   - Add "heatmap" to VisualizationType in `dashboard/src/types.ts`
   - Add case in `Visualization.tsx`
   - Add toggle in `PanelEditor.tsx`

3. **Verify**:
   - Run `make format` to auto-format code
   - Run `make lint` to check formatting, lint rules, and types
   - Run `make build` to confirm production build
```

### 3. Maintainer Assigns an Agent

Once approved, a maintainer assigns the issue to an AI agent. The agent creates a PR, implements your plan, runs validation, and responds to review feedback until the PR is merged.

## UI Changes

**All UI changes must include screenshots in the PR.** When your issue results in any visual change to the dashboard, the implementing PR must contain before/after screenshots demonstrating the change. Issues that describe UI changes should explicitly ask the agent to capture and attach screenshots.
Before posting screenshots, run `cd dashboard && npm run screenshot:preflight -- --url http://127.0.0.1:3000 --output screenshot-preflight.json` and attach diagnostics instead of screenshots when errors are detected.

## Issue Guidelines

- **Bugs**: Include reproduction steps, expected vs actual behavior, and proposed fix
- **Features**: Explain the use case, provide examples, and include step-by-step instructions
- **Be specific**: Name the files, components, and test cases the agent should touch
- **UI changes**: Remind the agent to include before/after screenshots in the PR

## Security

If you discover a security vulnerability, please use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) — **do not** open a public issue.

## Further Reading

- [Development guide](DEVELOPING.md)
- [README](README.md)
