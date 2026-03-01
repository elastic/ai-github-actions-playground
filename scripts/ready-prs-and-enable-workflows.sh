#!/usr/bin/env bash
# ready-prs-and-enable-workflows.sh
#
# Helper script to mark all open draft PRs as ready for review and
# approve PR workflow runs that require maintainer approval via the GitHub CLI (gh).
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
        APPROVED_RUNS=$((APPROVED_RUNS + 1))
      else
        echo "✗ failed"
        echo "      $output" >&2
        FAILED_APPROVALS+=("PR #$pr_number run $run_id ($workflow_name)")
      fi
    done <<< "$ACTION_REQUIRED_RUNS"

    echo ""
  done <<< "$OPEN_PRS"

  if [[ ${#FAILED_APPROVALS[@]} -eq 0 ]]; then
    if [[ $APPROVED_RUNS -eq 0 ]]; then
      echo "No PR workflow runs required approval."
    else
      echo "Approved $APPROVED_RUNS workflow run(s)."
    fi
  else
    echo "The following workflow approvals failed:" >&2
    for item in "${FAILED_APPROVALS[@]}"; do
      echo "  - $item" >&2
    done
    exit 1
  fi
fi
