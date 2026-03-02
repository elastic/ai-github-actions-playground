# PR State Machine

A formal specification of every state a bot-authored PR can be in and what
action to take. Serves as both a human-readable runbook and a machine-parseable
spec for `ready-prs-and-enable-workflows.sh`.

> **Scope:** Bot-authored PRs only — `copilot[bot]`, `copilot-swe-agent[bot]`,
> `github-actions[bot]`. Human PRs are out of scope.

---

## State Diagram

```
                         ┌──────────┐
                         │  DRAFT   │
                         └────┬─────┘
                   gh pr ready│
                              v
                      ┌──────────────┐
                      │  READY_NEW   │  (no CI runs yet)
                      └──────┬───────┘
             approve runs /  │  \ kick CI (bot commit)
                             v
               ┌─────────────────────────┐
               │       CI_PENDING        │
               └──────┬──────────┬───────┘
           passes     │          │  fails
                      v          v
            ┌──────────┐   ┌──────────────┐
            │ CI_GREEN  │   │  CI_FAILING  │──> delegate fix
            └─────┬─────┘   └──────────────┘
                  │
         ┌────────┼──────────┐
         v        v          v
   ┌──────────┐ ┌──────────┐ ┌───────────────────┐
   │ APPROVED │ │REVIEW_REQ│ │CHANGES_REQUESTED  │
   └────┬─────┘ └─────┬────┘ └────────┬──────────┘
        │     trigger  │      delegate │
        │     review   │               │
        v              v               v
   ┌───────────┐  (wait for      (wait for
   │MERGE_READY│    review)    address workflow)
   └─────┬─────┘
         │ gh pr merge --squash
         v
   ┌──────────┐
   │  MERGED  │
   └──────────┘

   Orthogonal blocker (any non-draft state):
   ┌──────────────┐
   │ CONFLICTING  │──> rebase in worktree (Pass 2)
   └──────────────┘
```

---

## Dimensions

Six axes define the composite state of every PR.

### 1. `draft_status`

| Value | Condition |
|-------|-----------|
| `DRAFT` | `isDraft == true` and title does NOT contain `[WIP]` |
| `DRAFT_WIP` | title contains `[WIP]` (case-insensitive) |
| `READY` | `isDraft == false` and no `[WIP]` in title |

### 2. `merge_status`

| Value | Condition |
|-------|-----------|
| `MERGEABLE` | `mergeable == "MERGEABLE"` |
| `CONFLICTING` | `mergeable == "CONFLICTING"` |
| `UNKNOWN` | `mergeable == "UNKNOWN"` — retry after 30 s |

### 3. `ci_status`

| Value | Condition |
|-------|-----------|
| `NO_RUNS` | Zero workflow runs for `event == "pull_request"` matching head SHA |
| `ACTION_REQUIRED` | At least one run has `status == "action_required"` |
| `QUEUED` | Runs exist but are queued, none failing |
| `IN_PROGRESS` | At least one run in progress, none failing |
| `PASSING` | All completed runs succeeded (or skipped) |
| `FAILING` | At least one completed run has `conclusion == "failure"` |

### 4. `review_status`

| Value | Condition |
|-------|-----------|
| `NULL` | `reviewDecision` is null — no review policy |
| `REVIEW_REQUIRED` | `reviewDecision == "REVIEW_REQUIRED"` |
| `APPROVED` | `reviewDecision == "APPROVED"` and at least one approver is non-bot |
| `CHANGES_REQUESTED` | `reviewDecision == "CHANGES_REQUESTED"` |

> Bot approvals (`*[bot]`) do **not** count for merge readiness.

### 5. `bot_commit`

| Value | Condition |
|-------|-----------|
| `true` | Last commit author matches `*[bot]` |
| `false` | Last commit author is a human |

Bot commits via `GITHUB_TOKEN` do not fire `pull_request` events, so CI
never starts automatically.

### 6. `address_workflow`

| Value | Condition |
|-------|-----------|
| `IDLE` | No "Address PR Review Feedback" run is `in_progress` or `queued` |
| `RUNNING` | At least one such run is active |

---

## Command Reference

Each command is defined once and referenced by ID throughout.

### `CMD_LIST_BOT_PRS`

```bash
gh pr list --state open --limit 200 \
  --json number,title,isDraft,author,headRefName,mergeable,mergeStateStatus,headRefOid,reviewDecision,labels \
  --jq '.[] | select(
    (.author.login | test("^(copilot|github-actions)\\[bot\\]$|^copilot-swe-agent\\[bot\\]$"))
  )'
```

### `CMD_MARK_READY`

```bash
gh pr ready "$NUMBER"
```

### `CMD_APPROVE_RUNS`

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view "$NUMBER" --json headRefOid --jq '.headRefOid')
gh run list --limit 200 \
  --json databaseId,status,event,headSha \
  --jq ".[] | select(.event == \"pull_request\" and .status == \"action_required\" and .headSha == \"$HEAD_SHA\") | .databaseId" \
  | while IFS= read -r run_id; do
      [ -n "$run_id" ] && gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve"
    done
```

### `CMD_CHECK_LAST_AUTHOR`

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view "$NUMBER" --json headRefOid --jq '.headRefOid')
gh api "repos/$REPO_SLUG/commits/$HEAD_SHA" --jq '.author.login // .commit.author.name'
```

### `CMD_KICK_CI_RERUN`

```bash
BRANCH=$(gh pr view "$NUMBER" --json headRefName --jq '.headRefName')
RUN_ID=$(gh run list --branch "$BRANCH" --limit 10 \
  --json databaseId,name,status \
  --jq '[.[] | select(.name == "CI" and .status == "completed")] | first | .databaseId // empty')
[ -n "$RUN_ID" ] && gh run rerun "$RUN_ID"
```

### `CMD_KICK_CI_EMPTY_COMMIT`

```bash
BRANCH=$(gh pr view "$NUMBER" --json headRefName --jq '.headRefName')
TMPDIR=$(mktemp -d)
git fetch origin "$BRANCH"
git worktree add "$TMPDIR" "$BRANCH"
git -C "$TMPDIR" commit --allow-empty -m "ci: trigger CI checks"
git -C "$TMPDIR" push
git worktree remove --force "$TMPDIR"
```

### `CMD_CHECK_CI`

```bash
gh pr checks "$NUMBER"
```

### `CMD_GET_FAILED_LOG`

```bash
gh run view "$RUN_ID" --log-failed
```

### `CMD_CHECK_ADDRESS_WF`

```bash
BRANCH=$(gh pr view "$NUMBER" --json headRefName --jq '.headRefName')
gh run list --branch "$BRANCH" --limit 10 \
  --json name,status \
  --jq '.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))'
```

### `CMD_DELEGATE_COPILOT`

```bash
gh pr comment "$NUMBER" --body "@copilot $MESSAGE"
```

### `CMD_DELEGATE_AI`

```bash
gh pr comment "$NUMBER" --body "/ai $MESSAGE"
```

### `CMD_TRIGGER_REVIEW`

```bash
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="$NUMBER" \
  --field prompt="Please review this PR. Assess correctness, code quality, and alignment with DEVELOPING.md. Approve if good, request changes if needed."
```

### `CMD_MERGE`

```bash
gh pr merge "$NUMBER" --squash --delete-branch
```

### `CMD_REBASE_WORKTREE`

```bash
BRANCH=$(gh pr view "$NUMBER" --json headRefName --jq '.headRefName')
TMPDIR=$(mktemp -d)
git fetch origin main "$BRANCH"
git worktree add "$TMPDIR" "$BRANCH"
git -C "$TMPDIR" rebase origin/main
# resolve any conflicts, then:
git -C "$TMPDIR" push --force-with-lease
git worktree remove --force "$TMPDIR"
```

---

## Composite States

### Tier 0 — Skip

| State | Conditions | Action |
|-------|-----------|--------|
| `SKIP_HUMAN` | Author not in bot list | None — out of scope |
| `SKIP_WIP` | Title contains `[WIP]` (case-insensitive) | None — leave alone |

### Tier 1 — Quick wins (safe to automate)

| State | Conditions | Action | Next State |
|-------|-----------|--------|------------|
| `DRAFT_READY` | `draft_status == DRAFT` | `CMD_MARK_READY` | `READY_*` |
| `RUNS_BLOCKED` | `ci_status == ACTION_REQUIRED` | `CMD_APPROVE_RUNS` | `CI_PENDING` |
| `MERGE_READY` | `merge_status == MERGEABLE` AND `ci_status == PASSING` AND (`review_status == NULL` OR `review_status == APPROVED` with non-bot approver) | `CMD_MERGE` | `MERGED` |

### Tier 2 — CI attention

| State | Conditions | Action | Next State |
|-------|-----------|--------|------------|
| `CI_MISSING_BOT` | `ci_status == NO_RUNS` AND `bot_commit == true` | `CMD_KICK_CI_RERUN` or `CMD_KICK_CI_EMPTY_COMMIT` | `CI_PENDING` |
| `CI_MISSING_STALE` | `ci_status == NO_RUNS` AND `bot_commit == false` AND last commit > 1 hr ago | `CMD_KICK_CI_RERUN` or `CMD_KICK_CI_EMPTY_COMMIT` | `CI_PENDING` |
| `CI_PENDING` | `ci_status` in (`QUEUED`, `IN_PROGRESS`) AND duration < 30 min | Wait — move to next PR | (self) |
| `CI_PENDING_LONG` | `ci_status` in (`QUEUED`, `IN_PROGRESS`) AND duration > 30 min | Investigate for hangs | Manual |
| `CI_FAILING_ADDRESSABLE` | `ci_status == FAILING` AND `address_workflow == IDLE` | Delegate via `CMD_DELEGATE_*` | `CI_FAILING_DELEGATED` |
| `CI_FAILING_DELEGATED` | `ci_status == FAILING` AND `address_workflow == RUNNING` | Wait — already being handled | (self) |

### Tier 3 — Review attention

| State | Conditions | Action | Next State |
|-------|-----------|--------|------------|
| `REVIEW_NEEDED` | `ci_status == PASSING` AND `review_status == REVIEW_REQUIRED` | `CMD_TRIGGER_REVIEW` | (wait for review) |
| `CHANGES_ADDRESSABLE` | `review_status == CHANGES_REQUESTED` AND `address_workflow == IDLE` | Delegate via `CMD_DELEGATE_*` | `CHANGES_DELEGATED` |
| `CHANGES_DELEGATED` | `review_status == CHANGES_REQUESTED` AND `address_workflow == RUNNING` | Wait — already being handled | (self) |

### Tier 4 — Merge conflicts (Pass 2)

| State | Conditions | Action | Next State |
|-------|-----------|--------|------------|
| `CONFLICTING` | `merge_status == CONFLICTING` | `CMD_REBASE_WORKTREE` | Re-enter from Tier 1 |
| `UNKNOWN_MERGE` | `merge_status == UNKNOWN` | Retry after 30 s; treat as `MERGEABLE` after 60 s | `MERGEABLE` or `CONFLICTING` |

---

## Decision Tree

```
classify_pr(pr):
  IF pr.author NOT IN [copilot[bot], copilot-swe-agent[bot], github-actions[bot]]:
    -> SKIP_HUMAN

  IF pr.title matches /\[wip\]/i:
    -> SKIP_WIP

  IF pr.isDraft:
    -> DRAFT_READY

  IF pr.mergeable == "UNKNOWN":
    -> UNKNOWN_MERGE

  IF pr.mergeable == "CONFLICTING":
    -> CONFLICTING

  # ── From here: PR is READY and MERGEABLE ──

  ci       = compute_ci_status(pr.headRefOid)
  review   = pr.reviewDecision
  addr_wf  = check_address_workflow(pr.headRefName)
  bot      = check_last_author(pr.headRefOid)
  human_approved = has_human_approval(pr.reviews)

  # Tier 1: Quick wins
  IF ci == ACTION_REQUIRED:
    -> RUNS_BLOCKED

  IF ci == PASSING AND (review == NULL OR (review == APPROVED AND human_approved)):
    -> MERGE_READY

  # Tier 2: CI
  IF ci == NO_RUNS:
    IF bot:
      -> CI_MISSING_BOT
    ELSE:
      -> CI_MISSING_STALE

  IF ci IN (QUEUED, IN_PROGRESS):
    IF running_duration > 30min:
      -> CI_PENDING_LONG
    ELSE:
      -> CI_PENDING

  IF ci == FAILING:
    IF addr_wf == RUNNING:
      -> CI_FAILING_DELEGATED
    ELSE:
      -> CI_FAILING_ADDRESSABLE

  # Tier 3: Review
  IF ci == PASSING AND review == REVIEW_REQUIRED:
    -> REVIEW_NEEDED

  IF review == CHANGES_REQUESTED:
    IF addr_wf == RUNNING:
      -> CHANGES_DELEGATED
    ELSE:
      -> CHANGES_ADDRESSABLE

  # Fallback
  -> CI_PENDING
```

---

## Delegation Routing

| PR Author | Prefix | Mechanism |
|-----------|--------|-----------|
| `copilot-swe-agent[bot]` | `@copilot` | Triggers Copilot agent |
| `copilot[bot]` | `@copilot` | Triggers Copilot agent |
| `github-actions[bot]` | `/ai` | Triggers "Mention in PR" workflow |

---

## Workflow Interaction Map

| Workflow | Trigger | Auto/Manual | Skip Label |
|----------|---------|-------------|------------|
| CI | `pull_request` on `peek/**` paths | Auto | — |
| PR Review | `pull_request` (opened/sync/ready/label) | Auto | `skip-auto-pr-review` |
| Address PR Review Feedback | `pull_request_review` (submitted by bot) | Auto | `skip-auto-pr-address` |
| Update PR Body | `pull_request` (opened/sync/ready) | Auto | `skip-pr-body-update` |
| UI Smoke Test | `pull_request` on `peek/**` paths | Auto | — |
| Dependency Review | `pull_request` (dependabot/renovate only) | Auto | — |
| PR Actions Detective | `workflow_run` (on CI failure) | Auto (reactive) | — |
| Minimize Resolved Reviews | `pull_request_review` (submitted) | Auto | — |
| Mention in PR | `/ai` comment on PR | Manual | — |
| Trigger Mention by ID | `workflow_dispatch` | Manual | — |
| Docs PR Review | `/docs-review` comment on PR | Manual | — |

---

## Edge Cases

| # | Condition | Handling |
|---|-----------|---------|
| 1 | Bot commit + no CI runs | CI will never auto-trigger. Use `CMD_KICK_CI_RERUN` or `CMD_KICK_CI_EMPTY_COMMIT`. |
| 2 | Address workflow already running | Do NOT double-delegate. Check `CMD_CHECK_ADDRESS_WF` first. |
| 3 | CI running > 30 min | May be hung. Investigate run logs. |
| 4 | `UNKNOWN` mergeable | GitHub hasn't computed yet. Retry after 30 s, cap at 60 s. |
| 5 | Bot approvals | Do not count toward merge readiness. Filter `reviews[].author.login` excluding `*[bot]`. |
| 6 | Path-filtered CI | CI only triggers for `peek/**`, `Makefile`, `.github/workflows/ci.yml`. PRs not touching these paths get no CI — treat as `PASSING`. |
| 7 | PR behind main > 20 commits | Rebase in Pass 2 even if not conflicting, to keep diff manageable. |
| 8 | Address workflow concurrency | Has `cancel-in-progress: true` per PR. Triggering a new review may cancel an in-flight address run. |
| 9 | PR Actions Detective | Fires automatically on CI failure and posts diagnostics. Check for existing detective comment before delegating. |
| 10 | `skip-auto-pr-address` label | Address workflow won't auto-fire. Must delegate manually. |

---

## Processing Algorithm

### Pass 1 — Non-filesystem operations

```
1. Fetch all open PRs with CMD_LIST_BOT_PRS
2. Filter out SKIP_HUMAN and SKIP_WIP
3. For each PR, call classify_pr() to determine state
4. Sort by tier (Tier 1 first, then 2, then 3)
5. For each PR in priority order:
   a. Execute the action for its state
   b. Record the PR number and expected next state
6. After processing all, wait 2–5 min for CI/reviews to settle
7. Re-fetch and re-classify; process newly actionable PRs
```

### Pass 2 — Merge conflict resolution

```
1. Collect all PRs classified as CONFLICTING from Pass 1
2. For each, use CMD_REBASE_WORKTREE (requires filesystem access)
3. After push, re-enter Pass 1 for that PR
```

---

## Quick Reference

```bash
# List all bot-authored PRs with state info
gh pr list --state open --limit 200 \
  --json number,title,isDraft,author,mergeable,mergeStateStatus,reviewDecision \
  --jq '.[] | select(
    .isDraft == false and
    (.author.login | test("^(copilot|github-actions)\\[bot\\]$|^copilot-swe-agent\\[bot\\]$"))
  ) | "\(.number)\t\(.mergeStateStatus)\t\(.reviewDecision // "null")\t\(.title)"'

# Mark draft PR as ready
gh pr ready <NUMBER>

# Approve action_required runs for a specific PR
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')
gh run list --limit 200 \
  --json databaseId,status,event,headSha \
  --jq ".[] | select(.event == \"pull_request\" and .status == \"action_required\" and .headSha == \"$HEAD_SHA\") | .databaseId" \
  | while IFS= read -r run_id; do
      [ -n "$run_id" ] && gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve"
    done

# Check if Address PR Review Feedback is running
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
gh run list --branch "$BRANCH" --limit 10 \
  --json name,status \
  --jq '.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))'

# Delegate to bot
gh pr comment <NUMBER> --body "@copilot <message>"   # copilot PRs
gh pr comment <NUMBER> --body "/ai <message>"         # github-actions PRs

# Trigger AI review
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="<NUMBER>" \
  --field prompt="<PROMPT>"

# Merge when ready
gh pr merge <NUMBER> --squash --delete-branch

# Resolve conflicts in worktree
BRANCH=$(gh pr view <NUMBER> --json headRefName --jq '.headRefName')
TMPDIR=$(mktemp -d)
git fetch origin main "$BRANCH"
git worktree add "$TMPDIR" "$BRANCH"
git -C "$TMPDIR" rebase origin/main
# ... resolve conflicts ...
git -C "$TMPDIR" push --force-with-lease
git worktree remove --force "$TMPDIR"
```
