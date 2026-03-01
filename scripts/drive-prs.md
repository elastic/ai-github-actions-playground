# Drive PRs Forward

A runbook for an AI agent (Copilot CLI, Gemini CLI, etc.) to assess every open
PR in the repository and advance it to its next logical state.

Unlike the automated bash script (`ready-prs-and-enable-workflows.sh`), this
runbook is designed to be followed by an agent that can **read diffs, resolve
merge conflicts, and make judgment calls** about what a PR actually needs.

> **Scope:** This runbook only processes PRs authored by `copilot[bot]` /
> `copilot-swe-agent[bot]` and `github-actions[bot]`. Human-authored PRs are
> out of scope — leave them alone.

---

## Overview

Work in **two passes** to maximise throughput:

1. **Pass 1 — Do everything you can without touching the filesystem.**
   Process every non-conflicting PR: kick CI, approve blocked runs, trigger
   reviews, delegate fixes to bots, merge anything that is ready. Skip
   conflicting PRs entirely during this pass.

2. **Pass 2 — Resolve merge conflicts.**
   Only after all other work is dispatched, come back and fix conflicting PRs
   using git worktrees. By this point bots are already working on other issues
   in parallel.

---

## Setup

```bash
gh auth status          # confirm you are authenticated
gh repo set-default     # if working outside the repo directory
```

---

## Pass 1 — Process all non-conflicting PRs

### Step 0 — Mark all draft PRs as ready for review

```bash
# List all draft PRs from bot authors (excluding [WIP])
gh pr list --draft --limit 200 --json number,title,author \
  --jq '.[] | select(
    (.title | ascii_downcase | contains("[wip]") | not) and
    (.author.login | test("^(copilot|github-actions)\\[bot\\]$|^copilot-swe-agent\\[bot\\]$"))
  ) | "\(.number)\t\(.title)"'

# Mark a specific draft PR as ready
gh pr ready <NUMBER>
```

### Step 1 — List open bot-authored PRs

```bash
gh pr list --state open --limit 200 \
  --json number,title,isDraft,author,headRefName,mergeable,mergeStateStatus,headRefOid \
  --jq '.[] | select(
    .isDraft == false and
    (.title | ascii_downcase | contains("[wip]") | not) and
    (.author.login | test("^(copilot|github-actions)\\[bot\\]$|^copilot-swe-agent\\[bot\\]$"))
  ) | {number, title, author: .author.login, headRefName, mergeable, mergeStateStatus, headRefOid}'
```

For each PR, note its `mergeable` state:
- `CONFLICTING` → **skip for now** (handle in Pass 2)
- `UNKNOWN` → re-check in 30 s; if still unknown after a minute, treat as `MERGEABLE`
- `MERGEABLE` → process through Steps 2–6 below

### Step 2 — Approve workflow runs awaiting maintainer approval

Bot-authored commits often land with `action_required` runs that need a
maintainer to approve before CI starts.

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')

# Find action_required runs for this PR's SHA
gh run list --limit 200 \
  --json databaseId,status,workflowName,event,headSha \
  --jq '.[] | select(.event == "pull_request" and .status == "action_required" and .headSha == "'"$HEAD_SHA"'") | "\(.databaseId)\t\(.workflowName)"'

# Approve each one (there may be multiple runs)
# See Quick reference for the same pattern.
gh run list --limit 200 \
  --json databaseId,status,workflowName,event,headSha \
  --jq '.[] | select(.event == "pull_request" and .status == "action_required" and .headSha == "'"$HEAD_SHA"'") | .databaseId' \
  | while IFS= read -r run_id; do
      [ -n "$run_id" ] && gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve"
    done
```

### Step 3 — Kick CI if the last commit was from a bot

Bot commits via `GITHUB_TOKEN` do **not** fire the `pull_request` event, so CI
never runs automatically. Check who committed last:

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')
gh api "repos/$REPO_SLUG/commits/$HEAD_SHA" --jq '.author.login // .commit.author.name'
```

If the last author is any `*[bot]`, kick CI:

```bash
# Re-run the most recent completed CI run for this branch
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
RUN_ID=$(gh run list --branch "$BRANCH" --limit 10 \
  --json databaseId,name,status \
  --jq '[.[] | select(.name == "CI" and .status == "completed")] | first | .databaseId // empty')

if [ -n "$RUN_ID" ]; then
  gh run rerun "$RUN_ID"
else
  # No CI run exists yet — push an empty commit to trigger one
  git fetch origin "$BRANCH"
  git worktree add /tmp/pr-<NUMBER>-kick "$BRANCH" || { echo "Failed to create worktree"; exit 1; }
  cd /tmp/pr-<NUMBER>-kick
  git commit --allow-empty -m "ci: trigger CI checks"
  git push
  cd -
  git worktree remove --force /tmp/pr-<NUMBER>-kick
fi
```

### Step 4 — Check CI results

```bash
gh pr checks <NUMBER>
```

| Situation | Action |
|-----------|--------|
| CI `in_progress` / `queued` | Move on to the next PR; come back later |
| All checks passing | Continue to Step 5 |
| Checks failing | Delegate the fix (Step 4a) |
| No CI checks at all | Just kicked CI in Step 3 — move on |

#### Step 4a — Delegate failing CI to the bot

Before delegating, check that the "Address PR Review Feedback" workflow is not
already running for this PR (that job addresses CI failures too):

```bash
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
gh run list --branch "$BRANCH" --limit 10 \
  --json name,status \
  --jq '.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))'
```

If a run is already `in_progress` or `queued` → skip, it is already being handled.

If not, get the failure summary and delegate:

```bash
gh run view <RUN_ID> --log-failed   # get error details
```

For a **`copilot-swe-agent[bot]`** PR:

```bash
gh pr comment <NUMBER> --body "@copilot CI is failing. Please investigate and fix:
<paste the relevant error here>"
```

For a **`github-actions[bot]`** PR:

```bash
gh pr comment <NUMBER> --body "/ai CI is failing. Please investigate and fix:
<paste the relevant error here>"
```

Then move on to the next PR.

### Step 5 — Check for existing reviews

```bash
gh pr view <NUMBER> --json reviewDecision,reviews \
  --jq '{decision: .reviewDecision, reviews: [.reviews[] | {author: .author.login, state: .state}]}'
```

| `reviewDecision` | Action |
|-----------------|--------|
| `APPROVED` | Continue to Step 6 |
| `CHANGES_REQUESTED` | Delegate fix to bot (Step 5a) |
| `REVIEW_REQUIRED` | Trigger a review (Step 5b) |
| `null` | No policy — continue to Step 6 |

#### Step 5a — Delegate CHANGES_REQUESTED to the bot

First check if "Address PR Review Feedback" is already running:

```bash
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
gh run list --branch "$BRANCH" --limit 10 \
  --json name,status \
  --jq '.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))'
```

If a run is already active → skip, it is already being handled.

If not, summarise the outstanding feedback and delegate:

For a **`copilot-swe-agent[bot]`** PR:

```bash
gh pr comment <NUMBER> --body "@copilot Please address the review feedback:
<summarise the specific changes requested>"
```

For a **`github-actions[bot]`** PR:

```bash
gh pr comment <NUMBER> --body "/ai Please address the review feedback:
<summarise the specific changes requested>"
```

Then move on to the next PR.

#### Step 5b — Trigger an AI review

```bash
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="<NUMBER>" \
  --field prompt="Please review this PR. Assess the changes for correctness, \
code quality, and alignment with the project standards in DEVELOPING.md. \
If the PR looks good, approve it. If changes are needed, request them."
```

### Step 6 — Merge if ready

A PR is ready to merge when **all** of the following are true:

- No merge conflicts
- All required CI checks pass
- `reviewDecision` is `APPROVED` (ignore approvals from `*[bot]` accounts)
- No unresolved `CHANGES_REQUESTED` reviews

```bash
gh pr merge <NUMBER> --squash --delete-branch
```

If not ready, note the blocker and move on.

---

## Pass 2 — Resolve merge conflicts

After completing Pass 1 for all non-conflicting PRs, return to every PR that
was skipped because `mergeable == CONFLICTING`.

Use a **git worktree** so you can work on multiple PRs in parallel without
polluting your main checkout:

```bash
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
git fetch origin main "$BRANCH"

# Isolated working directory for this PR
git worktree add /tmp/pr-<NUMBER> "$BRANCH"
cd /tmp/pr-<NUMBER>

git rebase origin/main
# For each conflict file:
#   - read both sides carefully
#   - favour the PR branch's intent; incorporate non-overlapping main changes
#   - do not silently discard either side
git add <files>
GIT_EDITOR=true git rebase --continue   # repeat until rebase completes

# Type-check before pushing (optional, repository-specific)
if [ -d peek ]; then
  cd peek && npx tsc --noEmit && cd ..
fi

git push --force-with-lease

cd -
git worktree remove /tmp/pr-<NUMBER>
```

After pushing, the PR re-enters the normal flow. Re-run Pass 1 for it (kick CI,
check reviews, etc.).

---

## Judgment calls

| Situation | Decision |
|-----------|----------|
| CI in_progress < 5 min | Move on; come back later |
| CI running > 30 min | Investigate for hangs |
| Last bot commit > 1 hour ago, no CI ever ran | Kick CI (Step 3) |
| "Address PR Review Feedback" job is active | Skip delegating — already handled |
| All checks pass, review approved, no conflicts | Merge it |
| PR is behind main by > 20 commits | Rebase in Pass 2 |

---

## Quick reference

```bash
# List bot-authored PRs needing attention
gh pr list --state open --limit 200 \
  --json number,title,isDraft,author,mergeStateStatus \
  --jq '.[] | select(
    .isDraft == false and
    (.author.login | test("^(copilot|github-actions)\\[bot\\]$|^copilot-swe-agent\\[bot\\]$"))
  ) | "\(.number)\t\(.mergeStateStatus)\t\(.author.login)\t\(.title)"'

# Mark a draft PR as ready
gh pr ready <NUMBER>

# Approve action_required workflow runs for a PR
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')
gh run list --limit 200 \
  --json databaseId,status,workflowName,event,headSha \
  --jq '.[] | select(.event == "pull_request" and .status == "action_required" and .headSha == "'"$HEAD_SHA"'") | .databaseId' \
  | while IFS= read -r run_id; do
      [ -n "$run_id" ] && gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve"
    done

# Check if Address PR Review Feedback is already running
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
gh run list --branch "$BRANCH" --limit 10 \
  --json name,status \
  --jq '.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))'

# Check a specific PR end-to-end
gh pr view <NUMBER>
gh pr checks <NUMBER>
gh pr diff <NUMBER>

# Resolve merge conflicts using a worktree (parallel-safe)
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
git fetch origin main "$BRANCH"
git worktree add /tmp/pr-<NUMBER> "$BRANCH"
cd /tmp/pr-<NUMBER>
GIT_EDITOR=true git rebase origin/main
# ... resolve conflicts ...
git push --force-with-lease
cd -
git worktree remove /tmp/pr-<NUMBER>

# Delegate a fix to the bot (NOT for merge conflicts)
# copilot-swe-agent[bot] → @copilot  |  github-actions[bot] → /ai
gh pr comment <NUMBER> --body "@copilot Please fix: <description>"
gh pr comment <NUMBER> --body "/ai Please fix: <description>"

# Trigger AI review
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="<NUMBER>" \
  --field prompt="<PROMPT>"

# Merge when ready
gh pr merge <NUMBER> --squash --delete-branch
```
