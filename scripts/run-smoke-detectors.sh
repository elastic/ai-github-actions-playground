#!/usr/bin/env bash
# run-smoke-detectors.sh
#
# Helper script to manually trigger all Explore agent workflows in this
# repository via the GitHub CLI (gh).
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#
# Usage:
#   ./scripts/run-smoke-detectors.sh
#   ./scripts/run-smoke-detectors.sh --repo elastic/ai-github-actions-playground
#   ./scripts/run-smoke-detectors.sh --delay 5

set -euo pipefail

REPO="${REPO:-}"
DELAY=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Error: --repo requires a value (e.g. owner/repo)" >&2
        echo "Usage: $0 [--repo <owner/repo>] [--delay <seconds>]" >&2
        exit 1
      fi
      REPO="$2"
      shift 2
      ;;
    --delay)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "Error: --delay requires a value in seconds (e.g. 5)" >&2
        echo "Usage: $0 [--repo <owner/repo>] [--delay <seconds>]" >&2
        exit 1
      fi
      DELAY="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--repo <owner/repo>] [--delay <seconds>]" >&2
      exit 1
      ;;
  esac
done

REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  REPO_ARGS=(--repo "$REPO")
fi

# Explore agent workflows that support workflow_dispatch
WORKFLOWS=(
  "explore-connection.yml"
  "explore-metrics.yml"
  "explore-traces.yml"
  "explore-query-lab.yml"
  "explore-data-management.yml"
  "explore-live-es.yml"
  "explore-customer-feedback.yml"
  "ui-designer-review.yml"
)

# Verify gh is available
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is not installed. See https://cli.github.com/" >&2
  exit 1
fi

echo "Triggering Explore agent workflows..."
if [[ "$DELAY" -gt 0 ]]; then
  echo "(${DELAY}s delay between each trigger)"
fi
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
  if [[ "$DELAY" -gt 0 && "$workflow" != "${WORKFLOWS[-1]}" ]]; then
    sleep "$DELAY"
  fi
done

echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "All explore workflows triggered successfully."
else
  echo "The following workflows could not be triggered:" >&2
  for w in "${FAILED[@]}"; do
    echo "  - $w" >&2
  done
  exit 1
fi
