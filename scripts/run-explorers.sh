#!/usr/bin/env bash
# Trigger the Run All Explorers workflow via GitHub Actions.
set -euo pipefail
gh workflow run run-all-explorers.yml
echo "Triggered run-all-explorers.yml"
