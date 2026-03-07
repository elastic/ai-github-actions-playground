#!/usr/bin/env bash
# Trigger the Run All Detectors workflow via GitHub Actions.
set -euo pipefail
gh workflow run run-all-detectors.yml
echo "Triggered run-all-detectors.yml"
