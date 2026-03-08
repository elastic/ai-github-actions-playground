#!/usr/bin/env bash
# Trigger the Run Add Data Explorers workflow via GitHub Actions.
set -euo pipefail
ref="$(git branch --show-current)"
if [[ -z "$ref" ]]; then
  echo "Current HEAD is detached; checkout a branch before running this script." >&2
  exit 1
fi
gh workflow run run-add-data-explorers.yml --ref "$ref"
echo "Triggered run-add-data-explorers.yml"
