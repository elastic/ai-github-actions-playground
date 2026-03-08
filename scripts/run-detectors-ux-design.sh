#!/usr/bin/env bash
# Trigger the Run Detectors – UX & Design workflow via GitHub Actions.
set -euo pipefail
ref="$(git branch --show-current)"
if [[ -z "$ref" ]]; then
  echo "Current HEAD is detached; checkout a branch before running this script." >&2
  exit 1
fi
gh workflow run run-detectors-ux-design.yml --ref "$ref"
echo "Triggered run-detectors-ux-design.yml"
