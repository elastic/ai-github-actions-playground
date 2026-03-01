#!/usr/bin/env bash
# ready-prs-and-enable-workflows.sh
#
# Helper script to move all open PRs forward. Runs four passes in order:
#
#  1. Draft → ready for review   (marks non-[WIP] drafts as ready)
#  2. Action-required approval   (approves/re-runs workflows awaiting maintainer)
#  3. CI kickstart               (re-runs CI when the last commit was a bot —
#                                  bot commits via GITHUB_TOKEN don't auto-trigger
#                                  pull_request events, silently stalling the PR)
#  4. Advance stalled PRs        (for each non-draft PR with no active checks:
#                                  - flags merge conflicts with a comment
#                                  - triggers an AI review when checks pass but
#                                    no review has been submitted yet)
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#
# Usage:
#   ./scripts/ready-prs-and-enable-workflows.sh
#   ./scripts/ready-prs-and-enable-workflows.sh --repo elastic/ai-github-actions-playground

set -euo pipefail

REPO="${REPO:-}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--repo <owner/repo>]" >&2
      exit 1
      ;;
  esac
done

REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  REPO_ARGS=(--repo "$REPO")
fi

# Verify gh is available
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is not installed. See https://cli.github.com/" >&2
  exit 1
fi

# Verify gh authentication
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Resolve owner/repo for API calls
if [[ -n "$REPO" ]]; then
  REPO_SLUG="$REPO"
else
  REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
fi

# ── Mark all open draft PRs as ready for review ─────────────────────────────

echo "Marking draft PRs as ready for review..."
echo ""

DRAFT_PRS=$(gh pr list "${REPO_ARGS[@]}" --draft --limit 200 --json number,title \
  --jq '.[] | select((.title | ascii_downcase | contains("[wip]")) | not) | "\(.number)\t\(.title)"')

if [[ -z "$DRAFT_PRS" ]]; then
  echo "  No open draft PRs found."
else
  FAILED_PRS=()
  while IFS=$'\t' read -r pr_number pr_title; do
    printf "  #%-5s %-50s" "$pr_number" "$pr_title"
    if output=$(gh pr ready "$pr_number" "${REPO_ARGS[@]}" 2>&1); then
      echo "✓ ready"
    else
      echo "✗ failed"
      echo "    $output" >&2
      FAILED_PRS+=("$pr_number")
    fi
  done <<< "$DRAFT_PRS"

  echo ""
  if [[ ${#FAILED_PRS[@]} -eq 0 ]]; then
    echo "All draft PRs marked as ready for review."
  else
    echo "The following PRs could not be marked as ready:" >&2
    for pr in "${FAILED_PRS[@]}"; do
      echo "  - #$pr" >&2
    done
    exit 1
  fi
fi

echo ""

# ── Approve PR workflow runs that require maintainer action ─────────────────

echo "Approving workflow runs that require maintainer approval..."
echo ""

OPEN_PRS=$(gh pr list "${REPO_ARGS[@]}" --state open --limit 200 --json number,title,headRefOid \
  --jq '.[] | select((.title | ascii_downcase | contains("[wip]")) | not) | "\(.number)\t\(.title)\t\(.headRefOid)"')

if [[ -z "$OPEN_PRS" ]]; then
  echo "  No open PRs found."
else
  FAILED_APPROVALS=()
  APPROVED_RUNS=0
  RERUN_RUNS=0

  while IFS=$'\t' read -r pr_number pr_title pr_sha; do
    [[ -z "$pr_number" ]] && continue
    echo "  PR #$pr_number: $pr_title"

    ACTION_REQUIRED_RUNS=$(gh run list "${REPO_ARGS[@]}" --limit 200 \
      --json databaseId,status,conclusion,workflowName,event,headSha \
      --jq '.[] | select(.event == "pull_request" and (.status == "action_required" or .conclusion == "action_required") and .headSha == "'"$pr_sha"'") | "\(.databaseId)\t\(.workflowName)"')

    if [[ -z "$ACTION_REQUIRED_RUNS" ]]; then
      echo "    No runs awaiting approval."
      continue
    fi

    while IFS=$'\t' read -r run_id workflow_name; do
      [[ -z "$run_id" ]] && continue
      printf "    %-45s" "$workflow_name"
      if output=$(gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve" 2>&1); then
        echo "✓ approved"
        APPROVED_RUNS=$((APPROVED_RUNS + 1))
      elif output=$(gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/rerun" 2>&1); then
        echo "✓ re-run"
        RERUN_RUNS=$((RERUN_RUNS + 1))
      else
        echo "✗ failed"
        echo "      $output" >&2
        FAILED_APPROVALS+=("PR #$pr_number run $run_id ($workflow_name)")
      fi
    done <<< "$ACTION_REQUIRED_RUNS"

    echo ""
  done <<< "$OPEN_PRS"

  if [[ ${#FAILED_APPROVALS[@]} -eq 0 ]]; then
    if [[ $APPROVED_RUNS -eq 0 && $RERUN_RUNS -eq 0 ]]; then
      echo "No PR workflow runs required approval or re-run."
    else
      echo "Approved $APPROVED_RUNS workflow run(s), re-ran $RERUN_RUNS run(s)."
    fi
  else
    echo "The following workflow approvals failed:" >&2
    for item in "${FAILED_APPROVALS[@]}"; do
      echo "  - $item" >&2
    done
    exit 1
  fi
fi

echo ""

# ── Advance stalled PRs ──────────────────────────────────────────────────────
#
# For every open non-draft PR (excluding [WIP]):
#   1. Merge conflicts         → post a one-time warning comment
#   2. Bot last commit, no CI  → re-run the most recent CI run for the branch
#   3. Checks pass, no review  → dispatch an AI review via trigger-mention-in-pr-by-id
#   4. Checks running          → skip
#   5. Checks failing          → skip (pr-actions-detective handles failures)

echo "Advancing stalled PRs..."
echo ""

# Bot logins whose commits do NOT auto-trigger pull_request CI events
BOT_LOGINS=("github-actions[bot]" "copilot[bot]" "app/github-actions" "app/copilot")

is_bot_login() {
  local login="$1"
  for bot in "${BOT_LOGINS[@]}"; do
    [[ "$login" == "$bot" ]] && return 0
  done
  # Any login ending in [bot] counts
  [[ "$login" == *"[bot]" ]] && return 0
  return 1
}

# Returns 0 (true) if a comment containing MARKER was posted within the last 7 days
has_recent_marker_comment() {
  local pr_number="$1"
  local marker="$2"
  local cutoff
  cutoff=$(date -u -v-7d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u --date='7 days ago' '+%Y-%m-%dT%H:%M:%SZ')

  gh api "repos/$REPO_SLUG/issues/$pr_number/comments" --paginate \
    --jq ".[] | select(.created_at > \"$cutoff\") | .body" 2>/dev/null \
    | grep -qF "$marker"
}

MARKER_CONFLICT="<!-- pr-driver:conflict -->"
MARKER_KICKSTART="<!-- pr-driver:kickstart -->"

# Fetch all open non-draft non-[WIP] PRs with the data we need
ALL_OPEN_PRS=$(gh pr list "${REPO_ARGS[@]}" --state open --limit 200 \
  --json number,title,isDraft,headRefOid,headRefName,mergeable,mergeStateStatus \
  --jq '.[] | select(
    .isDraft == false and
    ((.title | ascii_downcase | contains("[wip]")) | not)
  ) | "\(.number)\t\(.title)\t\(.headRefOid)\t\(.headRefName)\t\(.mergeable)\t\(.mergeStateStatus)"')

if [[ -z "$ALL_OPEN_PRS" ]]; then
  echo "  No open non-draft PRs found."
else
  while IFS=$'\t' read -r pr_number pr_title pr_sha pr_branch pr_mergeable pr_merge_state; do
    [[ -z "$pr_number" ]] && continue
    printf "  PR #%-5s %s\n" "$pr_number" "$pr_title"

    # ── 1. Merge conflicts ───────────────────────────────────────────────────
    if [[ "$pr_mergeable" == "CONFLICTING" || "$pr_merge_state" == "dirty" ]]; then
      if has_recent_marker_comment "$pr_number" "$MARKER_CONFLICT"; then
        echo "    ↳ merge conflicts (warning already posted)"
      else
        gh api -X POST "repos/$REPO_SLUG/issues/$pr_number/comments" \
          --field body="${MARKER_CONFLICT}
⚠️ **Merge conflicts detected.** This PR has conflicts with the base branch that require manual resolution before it can continue. Please rebase or merge the base branch into this branch." \
          --silent
        echo "    ↳ merge conflicts → posted warning comment"
      fi
      continue
    fi

    # ── 2. Check run status for this SHA ────────────────────────────────────
    CHECK_RUNS=$(gh api "repos/$REPO_SLUG/commits/$pr_sha/check-runs" \
      --jq '.check_runs[] | "\(.status)\t\(.conclusion)"' 2>/dev/null || true)

    ACTIVE_COUNT=0
    TOTAL_COUNT=0
    FAILED_COUNT=0
    PASSED_COUNT=0

    while IFS=$'\t' read -r status conclusion; do
      [[ -z "$status" ]] && continue
      TOTAL_COUNT=$((TOTAL_COUNT + 1))
      case "$status" in
        in_progress|queued|waiting|pending) ACTIVE_COUNT=$((ACTIVE_COUNT + 1)) ;;
        completed)
          case "$conclusion" in
            success|skipped|neutral) PASSED_COUNT=$((PASSED_COUNT + 1)) ;;
            failure|timed_out|cancelled|action_required) FAILED_COUNT=$((FAILED_COUNT + 1)) ;;
          esac
          ;;
      esac
    done <<< "$CHECK_RUNS"

    # Checks are running — nothing to do yet
    if [[ $ACTIVE_COUNT -gt 0 ]]; then
      echo "    ↳ $ACTIVE_COUNT check(s) active — skip"
      continue
    fi

    # ── 3. Detect bot last commit → kickstart CI ─────────────────────────────
    LAST_AUTHOR=$(gh api "repos/$REPO_SLUG/commits/$pr_sha" \
      --jq '.author.login // .commit.author.name' 2>/dev/null || true)

    if is_bot_login "$LAST_AUTHOR"; then
      # Find the most recent CI run for this branch
      CI_RUN_ID=$(gh run list "${REPO_ARGS[@]}" --branch "$pr_branch" \
        --workflow ci.yml --limit 5 --json databaseId,status \
        --jq '[.[] | select(.status == "completed")] | first | .databaseId' 2>/dev/null || true)

      if [[ -n "$CI_RUN_ID" && "$CI_RUN_ID" != "null" ]]; then
        if gh api -X POST "repos/$REPO_SLUG/actions/runs/$CI_RUN_ID/rerun" --silent 2>/dev/null; then
          echo "    ↳ last commit by $LAST_AUTHOR (bot) → re-ran CI run #$CI_RUN_ID"
        else
          echo "    ↳ last commit by $LAST_AUTHOR (bot) → CI re-run failed (may need manual trigger)"
        fi
      else
        # No CI run found — post a one-time note
        if has_recent_marker_comment "$pr_number" "$MARKER_KICKSTART"; then
          echo "    ↳ last commit by $LAST_AUTHOR (bot), no CI run to re-run (note already posted)"
        else
          gh api -X POST "repos/$REPO_SLUG/issues/$pr_number/comments" \
            --field body="${MARKER_KICKSTART}
🔄 **CI not triggered.** The last commit was from \`${LAST_AUTHOR}\` (a bot), which can prevent CI from running automatically. A maintainer can push a small change or manually trigger the CI workflow to restart checks." \
            --silent
          echo "    ↳ last commit by $LAST_AUTHOR (bot), no CI run found → posted kickstart note"
        fi
      fi
      continue
    fi

    # ── 4. All checks passed, no review → trigger AI review ─────────────────
    if [[ $TOTAL_COUNT -gt 0 && $FAILED_COUNT -eq 0 && $PASSED_COUNT -eq $TOTAL_COUNT ]]; then
      REVIEW_COUNT=$(gh api "repos/$REPO_SLUG/pulls/$pr_number/reviews" \
        --jq 'length' 2>/dev/null || echo "0")

      if [[ "$REVIEW_COUNT" -eq 0 ]]; then
        gh workflow run trigger-mention-in-pr-by-id.yml \
          "${REPO_ARGS[@]}" \
          --field pull-request-number="$pr_number" \
          --field prompt="Please review this PR. Assess the changes for correctness, code quality, and alignment with project standards (see DEVELOPING.md). If the PR looks good, approve it. If changes are needed, leave a review requesting them." \
          2>/dev/null && echo "    ↳ checks passed, no review → dispatched AI review" \
                      || echo "    ↳ checks passed, no review → failed to dispatch AI review (trigger-mention-in-pr-by-id.yml not found or no permissions)"
      else
        echo "    ↳ checks passed, $REVIEW_COUNT review(s) exist — nothing to do"
      fi
      continue
    fi

    # ── 5. Checks failing → pr-actions-detective handles it ─────────────────
    if [[ $FAILED_COUNT -gt 0 ]]; then
      echo "    ↳ $FAILED_COUNT check(s) failing — pr-actions-detective handles this"
      continue
    fi

    # No check runs at all (PR may not touch CI-gated paths)
    echo "    ↳ no check runs — PR may not touch CI-gated paths"

  done <<< "$ALL_OPEN_PRS"
fi

echo ""
echo "Done."
