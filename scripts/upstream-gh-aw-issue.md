# Upstream Issue for elastic/ai-github-actions

**Title:** Improve Playwright and Docker service support for frontend repos

**To file when API rate limit resets:**
```bash
gh issue create --repo elastic/ai-github-actions \
  --title "Improve Playwright and Docker service support for frontend repos" \
  --body-file scripts/upstream-gh-aw-issue.md
```

---

## Context

We run 8 Playwright-based agent workflows in `elastic/ai-github-actions-playground` (5 smoke tests, 2 love audits, 1 live ES smoke test). Every single one repeats the same boilerplate:

```yaml
setup-commands: |
  make setup
  cd peek && npx playwright install chromium
```

Or worse, embeds `make setup` + `npx playwright install chromium` directly in `additional-instructions`, consuming agent prompt tokens for something that should be infrastructure.

We also just added a Live Elasticsearch smoke agent that needs to `docker run` an ES container, wait for it, seed data, and clean up — all via manual bash commands in `additional-instructions`.

## Proposals

### 1. Auto-detect Playwright browsers in `runtime-setup.md`

The `runtime-setup.md` fragment already auto-detects and installs Node.js (from `.node-version`/`.nvmrc`), Python, Ruby, Go, and uv. It should also auto-detect Playwright.

**Proposed addition:**

```yaml
- name: Install Playwright browsers
  if: hashFiles('**/package.json') != '' && contains(hashFiles('**/package-lock.json'), '@playwright/test')
  run: npx playwright install chromium --with-deps
```

Since `network-ecosystems.md` already allows the `playwright` ecosystem, the network firewall would not block this.

**Impact:** Eliminates the most common `setup-commands` boilerplate for frontend repos. Every Playwright-using workflow would "just work" after `npm ci` without needing explicit browser installation.

### 2. Optional `services` input on scheduled-audit / scheduled-fix

Allow callers to declaratively request service containers that start before the agent begins and clean up after:

```yaml
jobs:
  run:
    uses: elastic/ai-github-actions/.github/workflows/gh-aw-scheduled-audit.lock.yml@main
    with:
      services: |
        elasticsearch:
          image: docker.elastic.co/elasticsearch/elasticsearch:9.0.0
          port: 9200
          env:
            discovery.type: single-node
            xpack.security.enabled: "false"
      additional-instructions: |
        Elasticsearch is running at http://localhost:9200 (no auth required).
        ...
```

The workflow would translate this into a `docker run` step before the agent starts, and a `docker stop/rm` step after.

**Impact:** Eliminates error-prone manual Docker management from agent instructions. Makes it trivial for any workflow to spin up databases, caches, or other services.

### 3. Playwright screenshot analysis fragment

A shared fragment that standardizes the "run Playwright, collect screenshots/DOM dumps, present to agent" pattern. Currently each of our 8 workflows has ~50 lines of duplicate instructions explaining:
- How to read screenshots from `test-results/*.png`
- How to read DOM dumps from `test-results/*-dom-*.html`
- What to look for in the screenshots
- How to format findings

A `gh-aw-fragments/playwright-audit.md` fragment could standardize this, reducing `additional-instructions` to just the test command and any domain-specific analysis instructions.

## Current Workaround

We're using `setup-commands` for Playwright installation and manual `docker run` in `additional-instructions` for Elasticsearch. This works but requires significant boilerplate in every workflow.

## References

- [Playground smoke tests](https://github.com/elastic/ai-github-actions-playground/tree/main/.github/workflows) — `smoke-*.yml` and `give-it-some-love*.yml`
- [Meet the Smoke Testers blog post](https://github.com/elastic/ai-github-actions/blob/main/docs/blog/posts/meet-the-smoke-testers.md)
- [`runtime-setup.md` fragment](https://github.com/elastic/ai-github-actions/blob/main/.github/workflows/gh-aw-fragments/runtime-setup.md)
- [`network-ecosystems.md` fragment](https://github.com/elastic/ai-github-actions/blob/main/.github/workflows/gh-aw-fragments/network-ecosystems.md)
