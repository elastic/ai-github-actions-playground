#!/usr/bin/env bash
# run-detectors.sh
#
# Helper script to manually trigger all Detector/Auditor workflows in this
# repository via the GitHub CLI (gh).
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#
# Usage:
#   ./scripts/run-detectors.sh
#   ./scripts/run-detectors.sh --repo elastic/ai-github-actions-playground

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

# Detector / Auditor workflows that support workflow_dispatch
WORKFLOWS=(
  "breaking-change-detector.yml"
  "bug-hunter.yml"
  "code-duplication-detector.yml"
  "docs-patrol.yml"
  "duplicate-issue-detector.yml"
  "flaky-test-investigator.yml"
  "iterative-ideas-man.yml"
  "newbie-contributor-patrol.yml"
  "performance-profiler.yml"
  "project-summary.yml"
  "stale-issues.yml"
  "text-auditor.yml"
)

# Verify gh is available
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is not installed. See https://cli.github.com/" >&2
  exit 1
fi

echo "Triggering Detector/Auditor workflows..."
echo ""

FAILED=()
for workflow in "${WORKFLOWS[@]}"; do
  printf "  %-45s" "$workflow"
  if output=$(gh workflow run "$workflow" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} 2>&1); then
    echo "✓ triggered"
  else
    echo "✗ failed"
    echo "    $output" >&2
    FAILED+=("$workflow")
  fi
done

echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "All workflows triggered successfully."
else
  echo "The following workflows could not be triggered:" >&2
  for w in "${FAILED[@]}"; do
    echo "  - $w" >&2
  done
  exit 1
fi
