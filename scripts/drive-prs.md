# Drive PRs Forward

A runbook for an AI agent (Copilot CLI, Gemini CLI, etc.) to assess every open
PR in the repository and advance it to its next logical state.

Unlike the automated bash script (`ready-prs-and-enable-workflows.sh`), this
runbook is designed to be followed by an agent that can **read diffs, resolve
merge conflicts, and make judgment calls** about what a PR actually needs.

---

## Setup

```bash
gh auth status          # confirm you are authenticated
gh repo set-default     # if working outside the repo directory
```

---

## Step 0 — Mark all draft PRs as ready for review

Draft PRs (except `[WIP]` ones) should be promoted before you start assessing
them. The `ready-prs-and-enable-workflows.sh` script does this automatically,
but you can also do it inline:

```bash
# List all draft PRs (excluding [WIP])
gh pr list --draft --limit 200 --json number,title \
  --jq '.[] | select((.title | ascii_downcase | contains("[wip]")) | not) | "\(.number)\t\(.title)"'

# Mark a specific draft PR as ready
gh pr ready <NUMBER>
```

Run this once at the start of a session. Then continue to Step 1.

---

## Step 1 — List all open, non-draft PRs

```bash
gh pr list --state open --limit 200 \
  --json number,title,isDraft,headRefName,mergeable,mergeStateStatus,headRefOid \
  --jq '.[] | select(.isDraft == false and ((.title | ascii_downcase | contains("[wip]")) | not))
        | {number, title, headRefName, mergeable, mergeStateStatus, headRefOid}'
```

Process each PR in the list through Steps 2–7 below.

---

## Step 2 — Check for merge conflicts

```bash
gh pr view <NUMBER> --json mergeable,mergeStateStatus
```

| `mergeable` | `mergeStateStatus` | Meaning |
|-------------|-------------------|---------|
| `CONFLICTING` | `dirty` | Has conflicts — **you can fix this** |
| `MERGEABLE` | `clean` / `has_hooks` / `blocked` | No conflicts |
| `UNKNOWN` | any | GitHub hasn't computed it yet — re-check in 30 s |

### If there are conflicts → resolve them

1. Check out the branch locally:
   ```bash
   gh pr checkout <NUMBER>
   ```
2. Identify conflicted files:
   ```bash
   git diff --name-only --diff-filter=U
   ```
3. For each conflicted file, read both sides and resolve intelligently:
   - Favour the PR branch's intent (it is the proposed change)
   - Incorporate any non-overlapping changes from `main`
   - Do not silently discard either side without understanding it
4. After resolving:
   ```bash
   git add <files>
   git commit -m "fix: resolve merge conflicts with main"
   git push
   ```
5. Return to Step 2 to confirm conflicts are cleared, then continue.

---

## Step 3 — Check active CI runs

```bash
gh run list --branch <HEAD_REF_NAME> --limit 10 \
  --json databaseId,status,conclusion,workflowName,headSha \
  --jq '.[] | select(.headSha == "<HEAD_SHA>")'
```

| Situation | Action |
|-----------|--------|
| Any run has `status: in_progress` or `queued` | **Wait** — checks are running. Move to next PR; come back later. |
| All runs `completed` | Continue to Step 4. |
| No runs at all | Check who made the last commit (Step 4). |
| Any run has `status: action_required` | Approve it (Step 3a), then wait. |

### Step 3a — Approve workflow runs awaiting maintainer approval

Some workflow runs (especially from first-time contributors or bot-authored
commits) are paused with `status: action_required` until a maintainer approves
them. The `ready-prs-and-enable-workflows.sh` script handles these automatically,
but you can also approve them manually:

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')

# Find action_required runs for this PR's SHA
gh run list --limit 200 \
  --json databaseId,status,workflowName,event,headSha \
  --jq '.[] | select(.event == "pull_request" and .status == "action_required" and .headSha == "'"$HEAD_SHA"'") | "\(.databaseId)\t\(.workflowName)"'

# Approve each run
gh api -X POST "repos/$REPO_SLUG/actions/runs/<RUN_ID>/approve"
```

After approving, **wait** for the newly-started runs to complete before continuing.

---

## Step 4 — Check who made the last commit

```bash
gh api repos/{owner}/{repo}/commits/<HEAD_SHA> --jq '.author.login // .commit.author.name'
```

### If the last commit was a bot (`github-actions[bot]`, `copilot[bot]`, or any `*[bot]`)

Bot commits via `GITHUB_TOKEN` do **not** fire the `pull_request` event, so CI
never runs automatically. Kick it off:

```bash
# Re-run the most recent CI run for this branch
RUN_ID=$(gh run list --branch <HEAD_REF_NAME> --workflow ci.yml --limit 5 \
  --json databaseId,status --jq '[.[] | select(.status == "completed")] | first | .databaseId')

gh run rerun "$RUN_ID"
```

If no CI run exists for this branch yet:

```bash
# Trigger CI by pushing an empty commit
git checkout <HEAD_REF_NAME>
git commit --allow-empty -m "ci: trigger CI run"
git push
```

Then **wait** for CI to complete before continuing with this PR.

---

## Step 5 — Assess CI results

```bash
gh pr checks <NUMBER>
```

| Situation | Action |
|-----------|--------|
| All checks passing | Continue to Step 6. |
| Checks failing | Investigate (Step 5a). |
| Checks skipped / not applicable | Continue to Step 6. |

### Step 5a — Investigate failing checks

```bash
# Get the failed run logs
gh run view <RUN_ID> --log-failed
```

Determine whether the failure is:

- **Caused by this PR's changes** → read the diff, understand the root cause,
  fix the code, push. Return to Step 3.
  ```bash
  gh pr diff <NUMBER>
  ```
- **A flaky test or infrastructure issue** → re-run the failed jobs:
  ```bash
  gh run rerun <RUN_ID> --failed
  ```
  Wait for re-run results before deciding.
- **Pre-existing on `main`** → note it in a PR comment and continue to Step 6.
  ```bash
  gh pr comment <NUMBER> --body "CI failure appears pre-existing on main (not introduced by this PR)."
  ```

---

## Step 6 — Check for existing reviews

```bash
gh pr view <NUMBER> --json reviews --jq '.reviews | length'
```

### If reviews exist

```bash
gh pr view <NUMBER> --json reviews \
  --jq '.reviews[] | {author: .author.login, state: .state, submittedAt: .submittedAt}'
```

| Review state | Action |
|-------------|--------|
| `APPROVED` | PR is ready to merge — check if it can be merged (Step 7). |
| `CHANGES_REQUESTED` | Address the feedback (Step 6a). |
| `COMMENTED` | Read comments; decide if they need action before merging. |

### If no reviews exist

```bash
# Dispatch an AI review via the repo's trigger workflow
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="<NUMBER>" \
  --field prompt="Please review this PR. Assess the changes for correctness, \
code quality, and alignment with the project standards in DEVELOPING.md. \
If the PR looks good, approve it. If changes are needed, request them."
```

Then **wait** for the review to be submitted before continuing.

### Step 6a — Address review feedback

1. Read the review comments:
   ```bash
   gh pr view <NUMBER> --json reviews,comments
   ```
2. For each change request:
   - Read the diff at the relevant line
   - Apply the fix if it is straightforward and clearly correct
   - If the fix requires architectural judgment, leave a reply explaining
     why you are deferring rather than silently skipping it
3. Push changes, then wait for CI (return to Step 3).

---

## Step 7 — Determine if the PR is ready to merge

A PR is ready to merge when **all** of the following are true:

- [ ] No merge conflicts
- [ ] All required CI checks pass
- [ ] At least one approving review
- [ ] No unresolved `CHANGES_REQUESTED` reviews

```bash
gh pr view <NUMBER> --json mergeable,mergeStateStatus,reviews,reviewDecision
```

| `reviewDecision` | Meaning |
|-----------------|---------|
| `APPROVED` | Ready |
| `CHANGES_REQUESTED` | Not ready |
| `REVIEW_REQUIRED` | Needs a review (go back to Step 6) |
| `null` | No review policy enforced — check checks + conflicts only |

### If ready → merge

```bash
gh pr merge <NUMBER> --squash --delete-branch
```

Use `--squash` to keep `main` history clean (matches repo convention).

### If not ready → leave a status comment

```bash
gh pr comment <NUMBER> --body "Assessed this PR — waiting on: <reason>."
```

Then move on to the next PR.

---

## Judgment calls: wait vs. act

Use this guide when unsure whether to take action or wait:

| Situation | Decision |
|-----------|----------|
| CI just started (< 5 min ago) | Wait |
| CI has been running > 30 min | Investigate for hangs |
| Last bot commit was > 1 hour ago with no CI | Kick CI (Step 4) |
| Review requested changes but bot already addressed them | Re-request review |
| PR is behind main by > 20 commits | Rebase before reviewing |
| PR description is empty or auto-generated and unclear | Post a comment asking the author to clarify intent before reviewing |
| All checks pass, review approved, no conflicts | Merge it |

---

## Quick reference

```bash
# List PRs needing attention
gh pr list --state open --json number,title,isDraft,mergeStateStatus \
  --jq '.[] | select(.isDraft == false) | "\(.number)\t\(.mergeStateStatus)\t\(.title)"'

# Mark a draft PR as ready
gh pr ready <NUMBER>

# Approve action_required workflow runs for a PR
REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
HEAD_SHA=$(gh pr view <NUMBER> --json headRefOid --jq '.headRefOid')
gh run list --limit 200 \
  --json databaseId,status,workflowName,event,headSha \
  --jq '.[] | select(.event == "pull_request" and .status == "action_required" and .headSha == "'"$HEAD_SHA"'") | .databaseId' \
  | xargs -I{} gh api -X POST "repos/$REPO_SLUG/actions/runs/{}/approve"

# Check a specific PR end-to-end
gh pr view <NUMBER>
gh pr checks <NUMBER>
gh pr diff <NUMBER>

# Checkout, resolve conflicts, push
gh pr checkout <NUMBER>
git diff --name-only --diff-filter=U
# ... edit files ...
git add . && git commit -m "fix: resolve merge conflicts" && git push

# Kick CI manually
gh workflow run ci.yml --ref <BRANCH>

# Trigger AI review
gh workflow run trigger-mention-in-pr-by-id.yml \
  --field pull-request-number="<NUMBER>" \
  --field prompt="<PROMPT>"

# Merge when ready
gh pr merge <NUMBER> --squash --delete-branch
```
