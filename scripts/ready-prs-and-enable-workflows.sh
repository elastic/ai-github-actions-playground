#!/usr/bin/env bash
# ready-prs-and-enable-workflows.sh
#
# Manage bot-authored PRs: mark drafts ready, approve blocked workflow runs,
# kick CI for bot commits, and report the state of every open PR.
#
# See scripts/pr-state-machine.md for the full state machine specification.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#
# Usage:
#   ./scripts/ready-prs-and-enable-workflows.sh
#   ./scripts/ready-prs-and-enable-workflows.sh --status-only
#   ./scripts/ready-prs-and-enable-workflows.sh --dry-run
#   ./scripts/ready-prs-and-enable-workflows.sh --repo elastic/ai-github-actions-playground

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

REPO="${REPO:-}"
DRY_RUN=false
STATUS_ONLY=false

BOT_AUTHOR_PATTERN='^(copilot|github-actions)\[bot\]$|^copilot-swe-agent\[bot\]$'

# ── Colors ────────────────────────────────────────────────────────────────────

if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' DIM='' RESET=''
fi

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --status-only)
      STATUS_ONLY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--repo <owner/repo>] [--dry-run] [--status-only]"
      echo ""
      echo "Options:"
      echo "  --repo <owner/repo>  Target a specific repository"
      echo "  --dry-run            Report what would be done without acting"
      echo "  --status-only        Skip phases 1-3, only classify and report PR status"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--repo <owner/repo>] [--dry-run] [--status-only]" >&2
      exit 1
      ;;
  esac
done

REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  REPO_ARGS=(--repo "$REPO")
fi

# ── Preflight checks ─────────────────────────────────────────────────────────

if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [[ -n "$REPO" ]]; then
  REPO_SLUG="$REPO"
else
  REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

action_prefix() {
  if $DRY_RUN; then
    printf '%s[dry-run]%s ' "$DIM" "$RESET"
  fi
}

is_bot_author() {
  local author="$1"
  [[ "$author" =~ $BOT_AUTHOR_PATTERN ]]
}

# Compute CI status for a given head SHA.
# Returns: NO_RUNS | ACTION_REQUIRED | QUEUED | IN_PROGRESS | PASSING | FAILING
compute_ci_status() {
  local head_sha="$1"
  local runs
  runs=$(gh run list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --limit 50 \
    --json databaseId,status,conclusion,event,headSha \
    --jq "[.[] | select(.event == \"pull_request\" and .headSha == \"$head_sha\")]")

  local count
  count=$(echo "$runs" | jq 'length')

  if [[ "$count" -eq 0 ]]; then
    echo "NO_RUNS"
    return
  fi

  # Check for action_required
  local action_req
  action_req=$(echo "$runs" | jq '[.[] | select(.status == "action_required" or .conclusion == "action_required")] | length')
  if [[ "$action_req" -gt 0 ]]; then
    echo "ACTION_REQUIRED"
    return
  fi

  # Check for in_progress or queued
  local pending
  pending=$(echo "$runs" | jq '[.[] | select(.status == "in_progress" or .status == "queued")] | length')

  # Check for failures among completed
  local failing
  failing=$(echo "$runs" | jq '[.[] | select(.status == "completed" and .conclusion == "failure")] | length')

  if [[ "$failing" -gt 0 ]]; then
    echo "FAILING"
    return
  fi

  if [[ "$pending" -gt 0 ]]; then
    echo "IN_PROGRESS"
    return
  fi

  echo "PASSING"
}

# Check if Address PR Review Feedback workflow is running for a branch.
# Returns: RUNNING | IDLE
check_address_workflow() {
  local branch="$1"
  local active
  active=$(gh run list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --branch "$branch" --limit 10 \
    --json name,status \
    --jq '[.[] | select(.name == "Address PR Review Feedback" and (.status == "in_progress" or .status == "queued"))] | length')

  if [[ "$active" -gt 0 ]]; then
    echo "RUNNING"
  else
    echo "IDLE"
  fi
}

# Check if last commit on a PR is from a bot.
# Returns: true | false
check_bot_commit() {
  local head_sha="$1"
  local author
  author=$(gh api "repos/$REPO_SLUG/commits/$head_sha" --jq '.author.login // .commit.author.name' 2>/dev/null || echo "unknown")

  if [[ "$author" == *"[bot]"* ]]; then
    echo "true"
  else
    echo "false"
  fi
}

# Classify a single PR into a state.
# Arguments: number title isDraft mergeable reviewDecision headRefOid headRefName author
classify_pr() {
  local number="$1" title="$2" is_draft="$3" mergeable="$4"
  local review="$5" head_sha="$6" branch="$7" author="$8"

  # Tier 0: Skip
  if ! is_bot_author "$author"; then
    echo "SKIP_HUMAN"
    return
  fi

  if echo "$title" | grep -qi '\[wip\]'; then
    echo "SKIP_WIP"
    return
  fi

  if [[ "$is_draft" == "true" ]]; then
    echo "DRAFT_READY"
    return
  fi

  # Merge status
  if [[ "$mergeable" == "UNKNOWN" ]]; then
    echo "UNKNOWN_MERGE"
    return
  fi

  if [[ "$mergeable" == "CONFLICTING" ]]; then
    echo "CONFLICTING"
    return
  fi

  # Compute dynamic dimensions
  local ci addr_wf bot_commit
  ci=$(compute_ci_status "$head_sha")
  addr_wf=$(check_address_workflow "$branch")
  bot_commit=$(check_bot_commit "$head_sha")

  # Tier 1: Quick wins
  if [[ "$ci" == "ACTION_REQUIRED" ]]; then
    echo "RUNS_BLOCKED"
    return
  fi

  if [[ "$ci" == "PASSING" && ("$review" == "APPROVED" || "$review" == "null") ]]; then
    echo "MERGE_READY"
    return
  fi

  # Tier 2: CI
  if [[ "$ci" == "NO_RUNS" ]]; then
    if [[ "$bot_commit" == "true" ]]; then
      echo "CI_MISSING_BOT"
    else
      echo "CI_MISSING_STALE"
    fi
    return
  fi

  if [[ "$ci" == "IN_PROGRESS" || "$ci" == "QUEUED" ]]; then
    echo "CI_PENDING"
    return
  fi

  if [[ "$ci" == "FAILING" ]]; then
    if [[ "$addr_wf" == "RUNNING" ]]; then
      echo "CI_FAILING_DELEGATED"
    else
      echo "CI_FAILING_ADDRESSABLE"
    fi
    return
  fi

  # Tier 3: Review
  if [[ "$ci" == "PASSING" && "$review" == "REVIEW_REQUIRED" ]]; then
    echo "REVIEW_NEEDED"
    return
  fi

  if [[ "$review" == "CHANGES_REQUESTED" ]]; then
    if [[ "$addr_wf" == "RUNNING" ]]; then
      echo "CHANGES_DELEGATED"
    else
      echo "CHANGES_ADDRESSABLE"
    fi
    return
  fi

  # Fallback
  echo "CI_PENDING"
}

# ── Phase 1: Mark drafts ready ───────────────────────────────────────────────

phase_mark_drafts_ready() {
  echo -e "${BOLD}Phase 1: Marking draft PRs as ready for review${RESET}"
  echo ""

  local draft_prs
  draft_prs=$(gh pr list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --draft --limit 200 --json number,title \
    --jq '.[] | select((.title | ascii_downcase | contains("[wip]")) | not) | "\(.number)\t\(.title)"')

  if [[ -z "$draft_prs" ]]; then
    echo "  No open draft PRs found."
    return 0
  fi

  local failed=0
  while IFS=$'\t' read -r pr_number pr_title; do
    [[ -z "$pr_number" ]] && continue
    printf "  $(action_prefix)#%-5s %-50s" "$pr_number" "$pr_title"
    if $DRY_RUN; then
      echo -e "${YELLOW}would mark ready${RESET}"
    elif output=$(gh pr ready "$pr_number" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} 2>&1); then
      echo -e "${GREEN}✓ ready${RESET}"
    else
      echo -e "${RED}✗ failed${RESET}"
      echo "    $output" >&2
      failed=$((failed + 1))
    fi
  done <<< "$draft_prs"

  echo ""
  return $failed
}

# ── Phase 2: Approve action_required workflow runs ───────────────────────────

phase_approve_runs() {
  echo -e "${BOLD}Phase 2: Approving workflow runs that require maintainer approval${RESET}"
  echo ""

  local open_prs
  open_prs=$(gh pr list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --state open --limit 200 --json number,title,headRefOid \
    --jq '.[] | select((.title | ascii_downcase | contains("[wip]")) | not) | "\(.number)\t\(.title)\t\(.headRefOid)"')

  if [[ -z "$open_prs" ]]; then
    echo "  No open PRs found."
    return 0
  fi

  local approved=0 failed=0

  while IFS=$'\t' read -r pr_number pr_title pr_sha; do
    [[ -z "$pr_number" ]] && continue

    local action_runs
    action_runs=$(gh run list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --limit 200 \
      --json databaseId,status,conclusion,workflowName,event,headSha \
      --jq '.[] | select(.event == "pull_request" and (.status == "action_required" or .conclusion == "action_required") and .headSha == "'"$pr_sha"'") | "\(.databaseId)\t\(.workflowName)"')

    [[ -z "$action_runs" ]] && continue

    echo "  PR #$pr_number: $pr_title"
    while IFS=$'\t' read -r run_id workflow_name; do
      [[ -z "$run_id" ]] && continue
      printf "    $(action_prefix)%-45s" "$workflow_name"
      if $DRY_RUN; then
        echo -e "${YELLOW}would approve${RESET}"
        approved=$((approved + 1))
      elif output=$(gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/approve" 2>&1); then
        echo -e "${GREEN}✓ approved${RESET}"
        approved=$((approved + 1))
      elif output=$(gh api -X POST "repos/$REPO_SLUG/actions/runs/$run_id/rerun" 2>&1); then
        echo -e "${GREEN}✓ re-run${RESET}"
        approved=$((approved + 1))
      else
        echo -e "${RED}✗ failed${RESET}"
        echo "      $output" >&2
        failed=$((failed + 1))
      fi
    done <<< "$action_runs"
    echo ""
  done <<< "$open_prs"

  if [[ $approved -eq 0 && $failed -eq 0 ]]; then
    echo "  No workflow runs required approval."
  elif [[ $approved -gt 0 ]]; then
    echo "  Approved $approved workflow run(s)."
  fi

  echo ""
  return $failed
}

# ── Phase 3: Kick CI for bot commits ─────────────────────────────────────────

phase_kick_ci() {
  echo -e "${BOLD}Phase 3: Kicking CI for bot commits without runs${RESET}"
  echo ""

  local bot_prs
  bot_prs=$(gh pr list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --state open --limit 200 \
    --json number,title,headRefOid,headRefName,isDraft,author \
    --jq '.[] | select(
      .isDraft == false and
      (.title | ascii_downcase | contains("[wip]") | not) and
      (.author.login | test("'"$BOT_AUTHOR_PATTERN"'"))
    ) | "\(.number)\t\(.title)\t\(.headRefOid)\t\(.headRefName)"')

  if [[ -z "$bot_prs" ]]; then
    echo "  No bot-authored PRs to check."
    echo ""
    return 0
  fi

  local kicked=0

  while IFS=$'\t' read -r pr_number pr_title head_sha branch; do
    [[ -z "$pr_number" ]] && continue

    # Check if last commit is from a bot
    local is_bot
    is_bot=$(check_bot_commit "$head_sha")
    [[ "$is_bot" != "true" ]] && continue

    # Check if CI runs exist
    local ci
    ci=$(compute_ci_status "$head_sha")
    [[ "$ci" != "NO_RUNS" ]] && continue

    printf "  $(action_prefix)#%-5s %-50s" "$pr_number" "$pr_title"

    if $DRY_RUN; then
      echo -e "${YELLOW}would kick CI${RESET}"
      kicked=$((kicked + 1))
      continue
    fi

    # Try to re-run an existing completed CI run
    local run_id
    run_id=$(gh run list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --branch "$branch" --limit 10 \
      --json databaseId,name,status \
      --jq '[.[] | select(.name == "CI" and .status == "completed")] | first | .databaseId // empty')

    if [[ -n "$run_id" ]]; then
      if gh run rerun "$run_id" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} 2>/dev/null; then
        echo -e "${GREEN}✓ re-ran CI run $run_id${RESET}"
        kicked=$((kicked + 1))
      else
        echo -e "${RED}✗ failed to re-run${RESET}"
      fi
    else
      echo -e "${YELLOW}no completed CI run to re-run (manual empty commit may be needed)${RESET}"
    fi
  done <<< "$bot_prs"

  if [[ $kicked -eq 0 ]]; then
    echo "  No bot PRs needed CI kicked."
  else
    echo "  Kicked CI for $kicked PR(s)."
  fi

  echo ""
  return 0
}

# ── Phase 4: Classify and report PR status ───────────────────────────────────

# Get color for a state
state_color() {
  case "$1" in
    MERGE_READY)                echo "$GREEN" ;;
    RUNS_BLOCKED|CI_FAILING_DELEGATED|CHANGES_DELEGATED|CI_MISSING_BOT|CI_MISSING_STALE)
                                echo "$YELLOW" ;;
    CI_FAILING_ADDRESSABLE|CHANGES_ADDRESSABLE|CI_PENDING_LONG|CONFLICTING)
                                echo "$RED" ;;
    REVIEW_NEEDED)              echo "$CYAN" ;;
    *)                          echo "$DIM" ;;
  esac
}

# Get label for a state
state_label() {
  case "$1" in
    MERGE_READY)              echo "MERGE READY" ;;
    RUNS_BLOCKED)             echo "RUNS BLOCKED (needs approval)" ;;
    CI_FAILING_ADDRESSABLE)   echo "CI FAILING (needs delegation)" ;;
    CI_FAILING_DELEGATED)     echo "CI FAILING (address workflow running)" ;;
    REVIEW_NEEDED)            echo "REVIEW NEEDED" ;;
    CHANGES_ADDRESSABLE)      echo "CHANGES REQUESTED (needs delegation)" ;;
    CHANGES_DELEGATED)        echo "CHANGES REQUESTED (address workflow running)" ;;
    CI_MISSING_BOT)           echo "CI MISSING (bot commit)" ;;
    CI_MISSING_STALE)         echo "CI MISSING (stale)" ;;
    CI_PENDING)               echo "CI PENDING" ;;
    CI_PENDING_LONG)          echo "CI PENDING (>30min — investigate)" ;;
    CONFLICTING)              echo "MERGE CONFLICTS" ;;
    UNKNOWN_MERGE)            echo "UNKNOWN MERGE STATUS" ;;
    DRAFT_READY)              echo "DRAFT (ready to mark)" ;;
    SKIP_WIP)                 echo "WIP (skipped)" ;;
    SKIP_HUMAN)               echo "HUMAN (out of scope)" ;;
    *)                        echo "$1" ;;
  esac
}

phase_report_status() {
  echo -e "${BOLD}Phase 4: PR Status Report${RESET}"
  echo ""

  local all_prs
  all_prs=$(gh pr list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --state open --limit 200 \
    --json number,title,isDraft,author,headRefOid,headRefName,mergeable,reviewDecision \
    --jq '.[] | "\(.number)\t\(.title)\t\(.isDraft)\t\(.mergeable)\t\(.reviewDecision // "null")\t\(.headRefOid)\t\(.headRefName)\t\(.author.login)"')

  if [[ -z "$all_prs" ]]; then
    echo "  No open PRs."
    echo ""
    return 0
  fi

  # Classify each PR and collect as "STATE\tentry" lines
  local classified_lines=""

  while IFS=$'\t' read -r number title is_draft mergeable review head_sha branch author; do
    [[ -z "$number" ]] && continue

    local state
    state=$(classify_pr "$number" "$title" "$is_draft" "$mergeable" "$review" "$head_sha" "$branch" "$author")

    # Build detail string
    local ci_label="" review_label=""
    case "$state" in
      SKIP_HUMAN|SKIP_WIP|DRAFT_READY|UNKNOWN_MERGE|CONFLICTING)
        ;;
      *)
        local ci_raw
        ci_raw=$(compute_ci_status "$head_sha")
        ci_label="CI:$ci_raw"
        review_label="Review:$review"
        ;;
    esac

    local addr_label=""
    if [[ "$state" == *"DELEGATED"* ]]; then
      addr_label="  Address:running"
    fi

    local entry
    entry=$(printf "#%-5s %-55s %s  %s%s" "$number" "${title:0:55}" "$ci_label" "$review_label" "$addr_label")

    if [[ -n "$classified_lines" ]]; then
      classified_lines+=$'\n'
    fi
    classified_lines+="${state}"$'\t'"${entry}"
  done <<< "$all_prs"

  # Print grouped by state in priority order
  local needs_attention=0
  local state_order="MERGE_READY RUNS_BLOCKED CI_FAILING_ADDRESSABLE CI_FAILING_DELEGATED REVIEW_NEEDED CHANGES_ADDRESSABLE CHANGES_DELEGATED CI_MISSING_BOT CI_MISSING_STALE CI_PENDING CI_PENDING_LONG CONFLICTING UNKNOWN_MERGE DRAFT_READY SKIP_WIP SKIP_HUMAN"

  for state in $state_order; do
    # Extract entries for this state
    local entries
    entries=$(echo "$classified_lines" | grep "^${state}"$'\t' | cut -f2- || true)
    [[ -z "$entries" ]] && continue

    local count
    count=$(echo "$entries" | wc -l | tr -d ' ')
    local color
    color=$(state_color "$state")
    local label
    label=$(state_label "$state")

    echo -e "  ${color}${BOLD}=== ${label} (${count}) ===${RESET}"
    while IFS= read -r entry; do
      echo -e "    ${color}${entry}${RESET}"
    done <<< "$entries"
    echo ""

    # Track items needing attention
    case "$state" in
      MERGE_READY|CI_FAILING_ADDRESSABLE|CHANGES_ADDRESSABLE|CONFLICTING|CI_MISSING_BOT|CI_MISSING_STALE|REVIEW_NEEDED|RUNS_BLOCKED)
        needs_attention=$((needs_attention + count))
        ;;
    esac
  done

  return $needs_attention
}

# ── Phase 5: Summary ─────────────────────────────────────────────────────────

phase_summary() {
  local needs_attention=$1

  echo -e "${BOLD}Summary${RESET}"
  if [[ $needs_attention -eq 0 ]]; then
    echo -e "  ${GREEN}All PRs are in a waiting state. Nothing to do.${RESET}"
  else
    echo -e "  ${YELLOW}${needs_attention} PR(s) need attention.${RESET}"
    echo ""
    echo "  Suggested next steps:"
    echo "    - Merge-ready PRs:  gh pr merge <NUMBER> --squash --delete-branch"
    echo "    - Failing CI:       Delegate with @copilot or /ai comment"
    echo "    - Review needed:    Trigger review via trigger-mention-in-pr-by-id workflow"
    echo "    - Conflicts:        Rebase in a worktree (see pr-state-machine.md)"
  fi
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${BOLD}PR Management — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
  echo -e "${DIM}Repository: $REPO_SLUG${RESET}"
  if $DRY_RUN; then
    echo -e "${YELLOW}Running in dry-run mode — no changes will be made${RESET}"
  fi
  if $STATUS_ONLY; then
    echo -e "${DIM}Status-only mode — skipping phases 1-3${RESET}"
  fi
  echo ""

  if ! $STATUS_ONLY; then
    phase_mark_drafts_ready || true
    phase_approve_runs || true
    phase_kick_ci || true
  fi

  local needs_attention=0
  phase_report_status || needs_attention=$?

  phase_summary "$needs_attention"

  if [[ $needs_attention -gt 0 ]]; then
    exit 1
  fi
}

main
