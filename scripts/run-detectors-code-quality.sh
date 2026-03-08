#!/usr/bin/env bash
# Trigger the Run Detectors – Code Quality workflow via GitHub Actions.
set -euo pipefail
ref="$(git branch --show-current)"
if [[ -z "$ref" ]]; then
  echo "Current HEAD is detached; checkout a branch before running this script." >&2
  exit 1
fi
gh workflow run run-detectors-code-quality.yml --ref "$ref"
echo "Triggered run-detectors-code-quality.yml"
