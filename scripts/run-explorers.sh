#!/usr/bin/env bash
# Trigger the Run All Explorers workflow via GitHub Actions.
set -euo pipefail
ref="$(git branch --show-current)"
if [[ -z "$ref" ]]; then
  echo "Current HEAD is detached; check out a branch before running this script." >&2
  exit 1
fi
gh workflow run run-all-explorers.yml --ref "$ref"
echo "Triggered run-all-explorers.yml"
