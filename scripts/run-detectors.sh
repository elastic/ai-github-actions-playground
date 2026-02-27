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
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Error: --repo requires a value (e.g. owner/repo)" >&2
        echo "Usage: $0 [--repo <owner/repo>]" >&2
        exit 1
      fi
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
  "agent-suggestions.yml"
  "autonomy-atomicity-analyzer.yml"
  "breaking-change-detector.yml"
  "bug-hunter.yml"
  "code-duplication-detector.yml"
  "docs-patrol.yml"
  "duplicate-issue-detector.yml"
  "flaky-test-investigator.yml"
  "framework-best-practices.yml"
  "give-it-some-love.yml"
  "information-architecture.yml"
  "iterative-ideas-man.yml"
  "medium-ideas-man.yml"
  "newbie-contributor-patrol.yml"
  "observability-ideas-man.yml"
  "performance-profiler.yml"
  "product-manager-impersonator.yml"
  "project-summary.yml"
  "react-state-bug-hunter.yml"
  "refactor-opportunist.yml"
  "security-ideas-man.yml"
  "stale-issues.yml"
  "text-auditor.yml"
  "ux-design-patrol.yml"
  "vector-search-ideas-man.yml"
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
  if output=$(gh workflow run "$workflow" --ref main ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} 2>&1); then
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
