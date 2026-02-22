#!/usr/bin/env bash
# ready-prs-and-enable-workflows.sh
#
# Helper script to mark all open draft PRs as ready for review and
# enable all disabled workflows in this repository via the GitHub CLI (gh).
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

# ── Mark all open draft PRs as ready for review ─────────────────────────────

echo "Marking draft PRs as ready for review..."
echo ""

DRAFT_PRS=$(gh pr list "${REPO_ARGS[@]+"${REPO_ARGS[@]}"}" --draft --json number,title --jq '.[] | "\(.number)\t\(.title)"')

if [[ -z "$DRAFT_PRS" ]]; then
  echo "  No open draft PRs found."
else
  FAILED_PRS=()
  while IFS=$'\t' read -r pr_number pr_title; do
    printf "  #%-5s %-50s" "$pr_number" "$pr_title"
    if output=$(gh pr ready "$pr_number" "${REPO_ARGS[@]+"${REPO_ARGS[@]}"}" 2>&1); then
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

# ── Enable all disabled workflows ────────────────────────────────────────────

echo "Enabling disabled workflows..."
echo ""

DISABLED_WORKFLOWS=$(gh workflow list "${REPO_ARGS[@]+"${REPO_ARGS[@]}"}" --all --json name,state,id \
  --jq '.[] | select(.state == "disabled_manually") | "\(.id)\t\(.name)"')

if [[ -z "$DISABLED_WORKFLOWS" ]]; then
  echo "  No disabled workflows found."
else
  FAILED_WORKFLOWS=()
  while IFS=$'\t' read -r workflow_id workflow_name; do
    printf "  %-45s" "$workflow_name"
    if output=$(gh workflow enable "$workflow_id" "${REPO_ARGS[@]+"${REPO_ARGS[@]}"}" 2>&1); then
      echo "✓ enabled"
    else
      echo "✗ failed"
      echo "    $output" >&2
      FAILED_WORKFLOWS+=("$workflow_name")
    fi
  done <<< "$DISABLED_WORKFLOWS"

  echo ""
  if [[ ${#FAILED_WORKFLOWS[@]} -eq 0 ]]; then
    echo "All disabled workflows enabled."
  else
    echo "The following workflows could not be enabled:" >&2
    for w in "${FAILED_WORKFLOWS[@]}"; do
      echo "  - $w" >&2
    done
    exit 1
  fi
fi
