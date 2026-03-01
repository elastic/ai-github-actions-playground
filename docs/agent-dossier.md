# GitHub Actions Agent Dossier

A comprehensive reference of all AI-powered GitHub Actions agents in this repository.

**Total Agents: 45** | **Framework:** `elastic/ai-github-actions` (gh-aw) | **Default Model:** `gpt-5.3-codex` (GitHub Copilot)

---

## Table of Contents

1. [Code Review & PR Agents](#1-code-review--pr-agents)
2. [Issue Management Agents](#2-issue-management-agents)
3. [Quality & Testing Agents](#3-quality--testing-agents)
4. [Code Quality Agents](#4-code-quality-agents)
5. [Documentation Agents](#5-documentation-agents)
6. [Security & Breaking Changes](#6-security--breaking-changes)
7. [Performance & Architecture](#7-performance--architecture)
8. [Idea Generation Agents](#8-idea-generation-agents)
9. [Exploratory Testing Agents](#9-exploratory-testing-agents)
10. [CI/CD & Deployment](#10-cicd--deployment)
11. [Team & Community Agents](#11-team--community-agents)
12. [Project Management Agents](#12-project-management-agents)
13. [Architecture & Execution Details](#architecture--execution-details)

---

## 1. Code Review & PR Agents

### PR Review

| | |
|---|---|
| **File** | `pr-review.yml` |
| **Calls** | `gh-aw-pr-review.lock.yml` |
| **Triggers** | PR opened, synchronized, reopened, ready_for_review, labeled, unlabeled |
| **Schedule** | Event-driven |

**What it does:** Automated code review pipeline. Reviews every non-draft PR file-by-file, reading full source (not just the patch) for context. Posts inline review comments with severity levels (critical > high > medium > low > nitpick). Actionable feedback is automatically addressed by the **PR Review Feedback Addresser** agent.

**Configuration:** `intensity: aggressive`, `minimum_severity: nitpick`, max 30 comments per run. Skip with the `skip-auto-pr-review` label.

---

### PR Review Feedback Addresser

| | |
|---|---|
| **File** | `address-pr-review-feedback.yml` |
| **Calls** | `gh-aw-pr-review-addresser.lock.yml` |
| **Triggers** | Any bot-submitted PR review (CodeRabbit, AI reviewer, etc.) |
| **Schedule** | Event-driven |

**What it does:** Automatically addresses minor and straightforward review feedback from bot reviewers. When CodeRabbit or the AI PR reviewer submits a review, this agent reads the review threads, makes surgical code fixes, pushes changes, resolves addressed threads, and replies to threads it skipped. Focuses on easy wins (typos, types, imports, simple logic) and explicitly skips complex architectural or subjective feedback.

**Configuration:** Allowed bots: `coderabbitai[bot]`, `github-actions[bot]`. Max 10 thread resolutions per run. Skip with the `skip-auto-pr-review` label.

---

### Mention in PR

| | |
|---|---|
| **File** | `mention-in-pr.yml` |
| **Calls** | `gh-aw-mention-in-pr-no-sandbox.lock.yml` |
| **Triggers** | `/ai` command in PR comments or review comments |

**What it does:** On-demand AI assistant for pull requests. Invoke with `/ai` followed by a question or instruction. Can answer questions about the code, review specific sections, suggest fixes, push changes, and resolve review threads. Runs without Docker sandbox for full system access. Max 30 review comments, 10 thread resolutions per run.

---

### Update PR Body

| | |
|---|---|
| **File** | `update-pr-body.yml` |
| **Calls** | `gh-aw-update-pr-body.lock.yml` |
| **Triggers** | PR opened, synchronized, reopened, ready_for_review |

**What it does:** Automatically cleans up and formats PR descriptions. Strips raw issue prompt text and restructures the body to follow the PR template. Uses `gpt-5.1-codex-mini` for speed. Skip with the `skip-pr-body-update` label.

---

### Docs PR Review

| | |
|---|---|
| **File** | `docs-pr-review.yml` |
| **Calls** | `gh-aw-docs-pr-review.lock.yml` |
| **Triggers** | `/docs-review` command in PR comments |

**What it does:** Specialized documentation reviewer. Invoked on-demand to audit PR changes for documentation quality — grammar, accuracy, completeness, and consistency with existing docs.

---

### PR Actions Detective

| | |
|---|---|
| **File** | `pr-actions-detective.yml` |
| **Calls** | `gh-aw-pr-actions-detective.lock.yml` |
| **Triggers** | CI/Build/Test workflow failures on PRs |

**What it does:** Automatically activates when CI fails on a PR. Analyzes the failure logs, diagnoses root causes, and posts findings as a comment to help the developer fix their build.

---

### Branch Actions Detective

| | |
|---|---|
| **File** | `branch-actions-detective.yml` |
| **Calls** | `gh-aw-branch-actions-detective.lock.yml` |
| **Triggers** | CI/Build/Test workflow failures on the default branch (not PRs) |

**What it does:** Same as PR Actions Detective but for failures directly on `main`. Only fires when the failure is not associated with any PR — catches post-merge breakage.

---

### Trigger Mention in PR by ID

| | |
|---|---|
| **File** | `trigger-mention-in-pr-by-id.yml` |
| **Calls** | `gh-aw-mention-in-pr-by-id.lock.yml` |
| **Triggers** | `workflow_dispatch` (manual with PR number + prompt) |

**What it does:** Internal utility workflow. Targets a specific PR by number with a custom prompt. Used by PR Review's follow-up stage to dispatch the AI agent to fix its own review findings. Adds an "eyes" reaction to the PR before running.

---

## 2. Issue Management Agents

### Mention in Issue

| | |
|---|---|
| **File** | `mention-in-issue.yml` |
| **Calls** | `gh-aw-mention-in-issue-no-sandbox.lock.yml` |
| **Triggers** | `/ai` command in issue comments |

**What it does:** On-demand AI assistant for issues. Invoke with `/ai` to ask questions, get analysis, or request code changes. Can create PRs, push code, and add detailed responses. Runs without sandbox for full system access.

---

### Issue Triage

| | |
|---|---|
| **File** | `issue-triage.yml` |
| **Calls** | `gh-aw-issue-triage.lock.yml` |
| **Triggers** | New issue opened |

**What it does:** Automatically categorizes and triages every new issue. Assigns labels, sets priority, and may add initial analysis comments to help with routing.

---

### Duplicate Issue Detector

| | |
|---|---|
| **File** | `duplicate-issue-detector.yml` |
| **Calls** | `gh-aw-duplicate-issue-detector.lock.yml` |
| **Triggers** | New issue opened |

**What it does:** Scans existing open and closed issues to determine if a newly opened issue is a duplicate. Comments with links to related issues when matches are found.

---

### Stale Issues

| | |
|---|---|
| **File** | `stale-issues.yml` |
| **Calls** | `gh-aw-stale-issues.lock.yml` |
| **Schedule** | Weekdays 15:00 UTC |

**What it does:** Identifies and manages inactive/stale issues. Tags or closes issues that have had no activity for an extended period.

---

### Plan

| | |
|---|---|
| **File** | `plan.yml` |
| **Calls** | `gh-aw-plan.lock.yml` |
| **Triggers** | `/plan` command in issue comments |

**What it does:** Generates detailed implementation plans for issues on demand. Analyzes the codebase, considers architecture, and posts a structured plan with steps, affected files, and trade-offs.

---

### Deep Research

| | |
|---|---|
| **File** | `deep-research.yml` |
| **Calls** | `gh-aw-deep-research.lock.yml` |
| **Triggers** | `/research` command in issue comments |

**What it does:** Performs in-depth research on an issue topic. Unlike most agents that use GitHub Copilot, this one uses **Google Gemini** (`GEMINI_API_KEY`) for comprehensive analysis.

---

## 3. Quality & Testing Agents

### Bug Hunter

| | |
|---|---|
| **File** | `bug-hunter.yml` |
| **Calls** | `gh-aw-bug-hunter.lock.yml` |
| **Schedule** | Weekdays 11:00 UTC |

**What it does:** Proactively scans the codebase for reproducible, user-impacting bugs. Has the **highest quality bar** of all agents — requires mandatory local reproduction (not just test suite), concrete failure scenarios, and evidence. Expected outcome most days is `noop` (a healthy codebase). Only files issues for genuine, verified bugs.

---

### Flaky Test Investigator

| | |
|---|---|
| **File** | `flaky-test-investigator.yml` |
| **Calls** | `gh-aw-flaky-test-investigator.lock.yml` |
| **Schedule** | Weekdays 14:00 UTC |

**What it does:** Analyzes test execution history across CI runs to identify tests that intermittently pass/fail. Investigates root causes of flakiness (timing, state leaks, race conditions) and files issues with diagnosis.

---

## 4. Code Quality Agents

### Code Duplication Detector

| | |
|---|---|
| **File** | `code-duplication-detector.yml` |
| **Calls** | `gh-aw-code-duplication-detector.lock.yml` |
| **Schedule** | Weekdays 12:00 UTC |

**What it does:** Analyzes the codebase for duplicated TypeScript code patterns. Identifies copy-paste code and suggests refactoring into shared utilities or abstractions.

---

### Refactor Opportunist

| | |
|---|---|
| **File** | `refactor-opportunist.yml` |
| **Calls** | `gh-aw-refactor-opportunist.lock.yml` |
| **Schedule** | Mondays 14:00 UTC |

**What it does:** Weekly scan for code modernization and refactoring opportunities. Identifies outdated patterns, unnecessary complexity, and areas that would benefit from restructuring.

---

### Text Auditor

| | |
|---|---|
| **File** | `text-auditor.yml` |
| **Calls** | `gh-aw-text-auditor.lock.yml` |
| **Schedule** | Weekdays 10:00 UTC |

**What it does:** Audits all user-facing text in the codebase for grammar, clarity, consistency, and typos. Catches wording issues that automated linters miss.

---

### Framework Best Practices

| | |
|---|---|
| **File** | `framework-best-practices.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Weekdays 13:00 UTC |
| **Issue prefix** | `[framework-best-practices]` |

**What it does:** Identifies opportunities to replace custom code with built-in framework and library features. Catches anti-patterns like:
- Reimplemented library features (e.g., custom debounce vs lodash)
- State management anti-patterns (raw useState vs Zustand)
- Custom UI components that duplicate MUI functionality
- Missing performance optimizations (React.memo, useMemo)
- Deprecated or legacy patterns

Files issues with specific library references, documentation links, and simplified code examples.

---

### Autonomy Atomicity Analyzer

| | |
|---|---|
| **File** | `autonomy-atomicity-analyzer.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Weekdays 16:00 UTC |
| **Issue prefix** | `[autonomy-atomicity]` |

**What it does:** Finds patterns that block parallel development — the structural issues that cause merge conflicts and developer contention:
- Global mutable state and singleton stores
- Manual routing/registration patterns (merge-conflict hotspots)
- God files with high import fan-in/fan-out
- Over-broad test files covering unrelated features
- Implicit ordering dependencies
- Shared configuration hotspots

---

## 5. Documentation Agents

### Docs Patrol

| | |
|---|---|
| **File** | `docs-patrol.yml` |
| **Calls** | `gh-aw-docs-patrol.lock.yml` |
| **Schedule** | Weekdays 10:00 UTC |

**What it does:** Detects documentation drift — where docs have fallen out of sync with the actual code. Scans for outdated information, broken references, and inconsistencies.

---

## 6. Security & Breaking Changes

### Breaking Change Detector

| | |
|---|---|
| **File** | `breaking-change-detector.yml` |
| **Calls** | `gh-aw-breaking-change-detector.lock.yml` |
| **Schedule** | Weekdays 13:00 UTC |

**What it does:** Scans for potential breaking changes to public APIs. Identifies modified function signatures, removed exports, changed interfaces, and other changes that could break consumers.

---

### Release Update Check

| | |
|---|---|
| **File** | `release-update.yml` |
| **Calls** | `gh-aw-release-update.lock.yml` |
| **Schedule** | Mondays 11:00 UTC |

**What it does:** Weekly check for dependency updates and new releases. Assesses upgrade needs and may create PRs to update dependencies.

---

## 7. Performance & Architecture

### Performance Profiler

| | |
|---|---|
| **File** | `performance-profiler.yml` |
| **Calls** | `gh-aw-performance-profiler.lock.yml` |
| **Schedule** | Weekdays 14:00 UTC |

**What it does:** Analyzes the codebase for performance bottlenecks. Identifies expensive renders, unnecessary re-computations, large bundle contributions, and optimization opportunities.

---

### Information Architecture

| | |
|---|---|
| **File** | `information-architecture.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Weekdays 17:00 UTC |
| **Issue prefix** | `[information-architecture]` |

**What it does:** Evaluates UI information architecture for usability and consistency:
- Navigation flow and logical ordering
- Button/action placement expectations
- Picker and selector positioning
- Data presentation formats
- Progressive disclosure patterns
- Grouping and visual hierarchy
- Empty states and onboarding flows

---

### UX Design Patrol

| | |
|---|---|
| **File** | `ux-design-patrol.yml` |
| **Calls** | `gh-aw-ux-design-patrol.lock.yml` |
| **Schedule** | Weekdays 13:00 UTC |

**What it does:** Analyzes UI components for design consistency, accessibility compliance, and usability issues. Catches visual inconsistencies and interaction pattern violations.

---

## 8. Idea Generation Agents

### Iterative Ideas Man

| | |
|---|---|
| **File** | `iterative-ideas-man.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Daily 09:00 UTC |
| **Issue prefix** | `[idea]` |

**What it does:** Daily generation of small, implementable feature ideas. Proposes real customer-requested features aligned with Elastic Peek (ES|QL query building, execution, visualization). Each idea includes a "why it won't be that hard" rationale with reference to concrete codebase data points. Checks for duplicate ideas before filing.

---

### Medium Ideas Man

| | |
|---|---|
| **File** | `medium-ideas-man.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Daily 10:00 UTC |
| **Issue prefix** | `[medium idea]` |

**What it does:** Daily generation of medium-complexity features (1-2 sprint scope). More substantial than iterative ideas — includes realistic implementation outlines (3-6 bullets), effort estimates, and risks/open questions.

---

### Observability Ideas Man

| | |
|---|---|
| **File** | `observability-ideas-man.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Daily 12:00 UTC |
| **Issue prefix** | `[observability idea]` |

**What it does:** Daily feature ideas from an SRE/platform engineering perspective. Focuses on observability pain points: log analysis, metric aggregation, distributed tracing, anomaly investigation, and service health dashboards. Each idea includes an example observability use case.

---

### Security Ideas Man

| | |
|---|---|
| **File** | `security-ideas-man.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Daily 11:00 UTC |
| **Issue prefix** | `[security idea]` |

**What it does:** Daily feature ideas from a SOC engineer/threat hunter perspective. Focuses on security workflows: threat hunting, alert triage, IOC investigation, detection engineering, and incident response. A different security angle each day.

---

### Vector Search Ideas Man

| | |
|---|---|
| **File** | `vector-search-ideas-man.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` (custom instructions) |
| **Schedule** | Daily 13:00 UTC |
| **Issue prefix** | `[search idea]` |

**What it does:** Daily feature ideas from a search engineer/AI product builder perspective. Focuses on: relevance tuning, semantic/hybrid search, embedding inspection, vector similarity, RAG pipelines, and search result analysis.

---

## 9. Exploratory Testing Agents

Seven Playwright-powered exploratory agents run on weekdays. Each owns a domain of the application and creatively invents novel interaction scenarios every run — they do NOT run pre-written test suites. Deterministic E2E tests run in CI instead. Agents only file issues for genuine bugs found through hands-on exploration.

| Agent | File | Schedule | Domain |
|-------|------|----------|--------|
| **Connection & Onboarding** | `smoke-welcome-flow.yml` | 09:00 UTC | Connection dialog, auth tabs, disconnect/reconnect, keyboard nav |
| **Metrics & Charts** | `smoke-metrics-flow.yml` | 10:00 UTC | Metric search, chart rendering, time ranges, state persistence |
| **Traces & Service Map** | `smoke-traces-flow.yml` | 11:00 UTC | Span trees, service map, trace-to-query pivot, navigation |
| **Query Lab & Console** | `smoke-auth-tab-switch.yml` | 12:00 UTC | ES\|QL queries, result tables, API Console, error handling |
| **Indices, Data Streams & Pipelines** | `smoke-reset-visibility.yml` | 13:00 UTC | Table sorting, detail views, data management |
| **Live Elasticsearch** | `smoke-live-es.yml` | 14:00 UTC | All pages with real OTel data and a real cluster |
| **Feature Gap Review** | `customer-complaints.yml` | 16:00 UTC | Missing features vs Kibana/Grafana/Elasticvue expectations |

All exploratory agents use `gh-aw-scheduled-audit.lock.yml` with creative Playwright exploration instructions.

### Give It Some Love

| | |
|---|---|
| **File** | `give-it-some-love.yml` |
| **Calls** | `gh-aw-scheduled-audit.lock.yml` |
| **Triggers** | Wednesdays 15:00 UTC, manual dispatch |
| **Schedule** | Weekly |

**What it does:** A Playwright-driven UI quality auditor that boots the full app with rich mocked Elasticsearch data and visits every major page. For each page it takes a full-page screenshot, runs axe-core accessibility checks, captures console errors/warnings, and checks for MUI error alerts. The AI agent then reads the screenshots and diagnostics output, cross-references with source code, and files a single `[love]` issue listing paper cuts, rough UI areas, and accessibility violations. Stays silent when everything looks polished.

**Test spec:** `peek/tests/e2e/love-audit.spec.ts` — covers Cluster Overview, Data Streams, Indices (all tabs), Ingest Pipelines, Query Lab, Metrics, Console, Users, Roles, Dashboards, and Fleet.

---

## 10. CI/CD & Deployment

### CI

| | |
|---|---|
| **File** | `ci.yml` |
| **Triggers** | PR or push to `main` (paths: `peek/**`, `Makefile`, CI workflow) |

**What it does:** The primary CI pipeline. Two parallel jobs:
1. **Lint & Build** — Node v24, `npm ci`, `make lint`, `make build`
2. **Unit Tests** — Node v24, `npm ci`, `make test-unit-coverage`

Uses concurrency groups to cancel superseded runs.

---

### Deploy to GitHub Pages

| | |
|---|---|
| **File** | `deploy-pages.yml` |
| **Triggers** | Push to `main` (paths: `peek/**`) or manual dispatch |

**What it does:** Builds the Peek application and deploys to GitHub Pages. Optionally generates a `demo.json` config with demo credentials from repository secrets. Two-stage: build artifact -> deploy.

---

### Publish Docker Image

| | |
|---|---|
| **File** | `publish-docker.yml` |
| **Triggers** | Push to `main` (paths: `peek/**`, `docker/**`, `Dockerfile`) |

**What it does:** Builds and pushes a Docker image to GitHub Container Registry (`ghcr.io`). Tags with `latest` and `sha-<commit>`. Uses Docker Buildx with GitHub Actions cache.

---

## 11. Team & Community Agents

### Newbie Contributor Patrol

| | |
|---|---|
| **File** | `newbie-contributor-patrol.yml` |
| **Calls** | `gh-aw-newbie-contributor-patrol.lock.yml` |
| **Schedule** | Mondays 11:00 UTC |

**What it does:** Weekly scan to identify and welcome new/first-time contributors. Provides guidance, points to good-first-issue opportunities, and creates a welcoming environment.

---

### Product Manager Impersonator

| | |
|---|---|
| **File** | `product-manager-impersonator.yml` |
| **Calls** | `gh-aw-product-manager-impersonator.lock.yml` |
| **Schedule** | Weekdays 10:00 UTC |

**What it does:** Generates product management perspectives. Analyzes the codebase and recent activity to produce roadmap suggestions, user-focused insights, and prioritization recommendations.

---

### Agent Suggestions

| | |
|---|---|
| **File** | `agent-suggestions.yml` |
| **Calls** | `gh-aw-agent-suggestions.lock.yml` |
| **Schedule** | Mondays 12:00 UTC |

**What it does:** Meta-agent that analyzes the repository and suggests which additional agent workflows would be beneficial. Recommends new automations based on repo health and patterns.

---

## 12. Project Management Agents

### Project Summary

| | |
|---|---|
| **File** | `project-summary.yml` |
| **Calls** | `gh-aw-project-summary.lock.yml` |
| **Schedule** | Daily 09:00 UTC |

**What it does:** Generates daily summaries of project activity — recent commits, PR status, issue counts, and overall project health metrics.

---

## Architecture & Execution Details

### How Agents Run

All agent workflows delegate to reusable workflows from `elastic/ai-github-actions`. Each reusable workflow runs two jobs:

1. **Activation** (`ubuntu-slim`) — Pre-flight checks, prompt construction, context setup, artifact upload
2. **Agent** (`ubuntu-latest`) — Full agent execution with MCP servers, sandbox/firewall, and safe output tools

### Prompt Assembly Pipeline

```
create_prompt_first.sh          # Initialize empty prompt
  -> xpia.md                    # System context (GitHub workspace, repo, actor)
  -> temp_folder_prompt.md      # Workspace setup
  -> markdown.md                # Formatting guidelines
  -> safe_outputs_prompt.md     # Tool descriptions
  -> workflow-specific prompt   # The actual task instructions
  -> interpolate_prompt.cjs     # Render handlebars templates
  -> substitute_placeholders.cjs # Replace GitHub context variables
  -> validate & upload          # Quality check, upload as artifact
```

### Execution Modes

| Mode | Isolation | Speed | Used By |
|------|-----------|-------|---------|
| **Sandboxed** | Docker container, `awf` firewall v0.20.2, domain whitelist (500+ allowed domains) | Standard | Most agents |
| **No-Sandbox** | Direct system access, no Docker | ~10x faster | Mention in Issue, Mention in PR |

### Safe Output Tools

All GitHub API mutations are wrapped in guardrailed tools:
- `safe-output-add-comment` — Comments on issues/PRs
- `safe-output-create-pr` — Create pull requests
- `safe-output-review-comment` — Inline PR review comments
- `safe-output-submit-review` — Full PR reviews
- `safe-output-create-issue` — File new issues
- `safe-output-resolve-thread` — Close review threads

### Quality Philosophy

> "Silence is better than noise."

All agents are coached to:
- Show exact evidence (file path, line number)
- Confirm assumptions before reporting
- `noop` is better than speculative findings
- Re-read as a skeptical reviewer before filing

### Common Inputs (all reusable workflows)

| Input | Description |
|-------|-------------|
| `additional-instructions` | Repo-specific instructions appended to agent prompt |
| `model` | AI model override (default: `gpt-5.3-codex`) |
| `allowed-bot-users` | Allowlisted bot usernames (default: `github-actions[bot]`) |
| `messages-footer` | Footer appended to all comments/reviews |
| `setup-commands` | Pre-execution shell commands (build, install, etc.) |

---

## Schedule Overview

| Time (UTC) | Weekdays | Daily | Weekly (Mon) | Weekly (Wed) |
|------------|----------|-------|--------------|--------------|
| 09:00 | Explore: Connection | Iterative Ideas, Project Summary | | |
| 10:00 | Text Auditor, Explore: Metrics | Medium Ideas | | |
| 10:00 | Product Manager | | | |
| 11:00 | Bug Hunter, Explore: Traces | Security Ideas | Newbie Contributor, Release Update | |
| 12:00 | Explore: Query Lab, Code Duplication | Observability Ideas | Agent Suggestions | |
| 13:00 | Breaking Changes, Framework Practices, Explore: Data Mgmt, UX Patrol | Vector Search Ideas | | |
| 14:00 | Explore: Live ES, Flaky Tests, Performance Profiler | | Refactor Opportunist | |
| 15:00 | Stale Issues | | | Give It Some Love |
| 16:00 | Autonomy Atomicity | | | |
| 17:00 | Information Architecture | | | |
