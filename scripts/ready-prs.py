#!/usr/bin/env python3
"""Manage bot-authored PRs: mark drafts ready, approve blocked workflow runs,
kick CI for bot commits, and report the state of every open PR.

See scripts/pr-state-machine.md for the full state machine specification.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

# ── Enums ────────────────────────────────────────────────────────────────────


class CIStatus(str, Enum):
    NO_RUNS = "NO_RUNS"
    ACTION_REQUIRED = "ACTION_REQUIRED"
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    PASSING = "PASSING"
    FAILING = "FAILING"


class PRState(str, Enum):
    SKIP_HUMAN = "SKIP_HUMAN"
    SKIP_WIP = "SKIP_WIP"
    DRAFT_READY = "DRAFT_READY"
    RUNS_BLOCKED = "RUNS_BLOCKED"
    MERGE_READY = "MERGE_READY"
    CI_MISSING_BOT = "CI_MISSING_BOT"
    CI_MISSING_STALE = "CI_MISSING_STALE"
    CI_PENDING = "CI_PENDING"
    CI_PENDING_LONG = "CI_PENDING_LONG"
    CI_FAILING_ADDRESSABLE = "CI_FAILING_ADDRESSABLE"
    CI_FAILING_DELEGATED = "CI_FAILING_DELEGATED"
    REVIEW_NEEDED = "REVIEW_NEEDED"
    CHANGES_ADDRESSABLE = "CHANGES_ADDRESSABLE"
    CHANGES_DELEGATED = "CHANGES_DELEGATED"
    CONFLICTING = "CONFLICTING"
    UNKNOWN_MERGE = "UNKNOWN_MERGE"


# ── State metadata (single source of truth) ──────────────────────────────────
# Iteration order = display priority in status report.


@dataclass(frozen=True)
class StateMeta:
    label: str
    color: str = "dim"
    ci: str = ""
    attention: bool = False


STATE_META: dict[PRState, StateMeta] = {
    PRState.MERGE_READY:            StateMeta("MERGE READY", "green", "PASSING", True),
    PRState.RUNS_BLOCKED:           StateMeta("RUNS BLOCKED (needs approval)", "yellow", "ACTION_REQUIRED", True),
    PRState.CI_FAILING_ADDRESSABLE: StateMeta("CI FAILING (needs delegation)", "red", "FAILING", True),
    PRState.CI_FAILING_DELEGATED:   StateMeta("CI FAILING (address wf running)", "yellow", "FAILING"),
    PRState.REVIEW_NEEDED:          StateMeta("REVIEW NEEDED", "cyan", "PASSING", True),
    PRState.CHANGES_ADDRESSABLE:    StateMeta("CHANGES REQUESTED (needs delegation)", "red", "PASSING", True),
    PRState.CHANGES_DELEGATED:      StateMeta("CHANGES REQUESTED (address wf running)", "yellow", "PASSING"),
    PRState.CI_MISSING_BOT:         StateMeta("CI MISSING (bot commit)", "yellow", "NO_RUNS", True),
    PRState.CI_MISSING_STALE:       StateMeta("CI MISSING (stale)", "yellow", "NO_RUNS", True),
    PRState.CI_PENDING:             StateMeta("CI PENDING", ci="IN_PROGRESS"),
    PRState.CI_PENDING_LONG:        StateMeta("CI PENDING (>30min)", "red", "IN_PROGRESS"),
    PRState.CONFLICTING:            StateMeta("MERGE CONFLICTS", "red", attention=True),
    PRState.UNKNOWN_MERGE:          StateMeta("UNKNOWN MERGE STATUS"),
    PRState.DRAFT_READY:            StateMeta("DRAFT (ready to mark)"),
    PRState.SKIP_WIP:               StateMeta("WIP (skipped)"),
    PRState.SKIP_HUMAN:             StateMeta("HUMAN (out of scope)"),
}


# ── Data types ───────────────────────────────────────────────────────────────

@dataclass
class PRInfo:
    number: int
    title: str
    author: str
    head_sha: str
    branch: str
    is_draft: bool
    mergeable: str
    review_decision: str
    author_is_bot: bool = False

    @property
    def is_bot(self) -> bool:
        return self.author_is_bot

    @property
    def is_wip(self) -> bool:
        return "[wip]" in self.title.lower()


@dataclass
class Ctx:
    """Shared context for all phases."""
    repo_slug: str
    repo_args: list[str]
    dry_run: bool


# ── Colors ───────────────────────────────────────────────────────────────────

_ANSI: dict[str, str] = {
    "red": "\033[31m", "green": "\033[32m", "yellow": "\033[33m",
    "cyan": "\033[36m", "bold": "\033[1m", "dim": "\033[2m", "reset": "\033[0m",
}
if not sys.stdout.isatty():
    _ANSI = {k: "" for k in _ANSI}

RED, GREEN, YELLOW, CYAN = _ANSI["red"], _ANSI["green"], _ANSI["yellow"], _ANSI["cyan"]
BOLD, DIM, RESET = _ANSI["bold"], _ANSI["dim"], _ANSI["reset"]


# ── gh CLI ───────────────────────────────────────────────────────────────────


def gh_json(*args: str, repo: list[str] = ()) -> Any:
    """Run gh and parse JSON stdout."""
    r = subprocess.run(["gh", *args, *repo], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return json.loads(r.stdout) if r.stdout.strip() else None


def gh_text(*args: str, repo: list[str] = ()) -> str:
    """Run gh and return stdout text."""
    r = subprocess.run(["gh", *args, *repo], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def gh_post(endpoint: str, repo_slug: str) -> bool:
    """POST to GitHub API endpoint. Returns True on success."""
    return subprocess.run(
        ["gh", "api", "-X", "POST", f"repos/{repo_slug}/{endpoint}"],
        capture_output=True,
    ).returncode == 0


# ── Pure classification (no side effects, fully testable) ────────────────────


def compute_ci_status(runs: list[dict], head_sha: str) -> CIStatus:
    pr_runs = [r for r in runs
               if r.get("event") == "pull_request" and r.get("headSha") == head_sha]
    if not pr_runs:
        return CIStatus.NO_RUNS
    if any(r.get("status") == "action_required" or r.get("conclusion") == "action_required"
           for r in pr_runs):
        return CIStatus.ACTION_REQUIRED
    if any(r.get("status") == "completed" and r.get("conclusion") == "failure"
           for r in pr_runs):
        return CIStatus.FAILING
    if any(r.get("status") in ("in_progress", "queued") for r in pr_runs):
        return CIStatus.IN_PROGRESS
    return CIStatus.PASSING


def has_active_address_wf(runs: list[dict], branch: str) -> bool:
    return any(
        r.get("name") == "Address PR Review Feedback"
        and r.get("headBranch") == branch
        and r.get("status") in ("in_progress", "queued")
        for r in runs
    )


def classify_pr(
    pr: PRInfo, ci: CIStatus, addr_wf: bool, bot_commit: bool,
) -> PRState:
    """Pure decision tree — matches pr-state-machine.md spec."""
    if not pr.is_bot:
        return PRState.SKIP_HUMAN
    if pr.is_wip:
        return PRState.SKIP_WIP
    if pr.is_draft:
        return PRState.DRAFT_READY
    if pr.mergeable == "UNKNOWN":
        return PRState.UNKNOWN_MERGE
    if pr.mergeable == "CONFLICTING":
        return PRState.CONFLICTING
    if ci == CIStatus.ACTION_REQUIRED:
        return PRState.RUNS_BLOCKED
    if ci == CIStatus.PASSING and pr.review_decision in ("APPROVED", "null", ""):
        return PRState.MERGE_READY
    if ci == CIStatus.NO_RUNS:
        return PRState.CI_MISSING_BOT if bot_commit else PRState.CI_MISSING_STALE
    if ci in (CIStatus.IN_PROGRESS, CIStatus.QUEUED):
        return PRState.CI_PENDING
    if ci == CIStatus.FAILING:
        return PRState.CI_FAILING_DELEGATED if addr_wf else PRState.CI_FAILING_ADDRESSABLE
    if ci == CIStatus.PASSING and pr.review_decision == "REVIEW_REQUIRED":
        return PRState.REVIEW_NEEDED
    if pr.review_decision == "CHANGES_REQUESTED":
        return PRState.CHANGES_DELEGATED if addr_wf else PRState.CHANGES_ADDRESSABLE
    return PRState.CI_PENDING


# ── Data fetching ────────────────────────────────────────────────────────────

_RUN_FIELDS = "databaseId,status,conclusion,workflowName,event,headSha,name,headBranch"
_PR_FIELDS = "number,title,isDraft,author,headRefOid,headRefName,mergeable,reviewDecision"


def fetch_runs(ctx: Ctx) -> list[dict]:
    return gh_json("run", "list", "--limit", "200", "--json", _RUN_FIELDS,
                   repo=ctx.repo_args)


def fetch_prs(ctx: Ctx) -> list[PRInfo]:
    raw = gh_json("pr", "list", "--state", "open", "--limit", "200",
                  "--json", _PR_FIELDS, repo=ctx.repo_args)
    return [PRInfo(
        number=p["number"], title=p["title"], author=p["author"]["login"],
        head_sha=p["headRefOid"], branch=p["headRefName"], is_draft=p["isDraft"],
        mergeable=p.get("mergeable", "UNKNOWN"),
        review_decision=p.get("reviewDecision") or "null",
        author_is_bot=p["author"].get("is_bot", False),
    ) for p in raw]


def is_bot_commit(ctx: Ctx, sha: str) -> bool:
    """Check if commit author is a bot (individual API call per SHA)."""
    try:
        author = gh_text("api", f"repos/{ctx.repo_slug}/commits/{sha}",
                         "--jq", ".author.login // .commit.author.name")
        return "[bot]" in author
    except RuntimeError:
        return False


# ── Phases ───────────────────────────────────────────────────────────────────


def _tag(ctx: Ctx) -> str:
    return f"{DIM}[dry-run]{RESET} " if ctx.dry_run else ""


def phase_mark_drafts(prs: list[PRInfo], ctx: Ctx) -> int:
    print(f"{BOLD}Phase 1: Marking draft PRs as ready{RESET}\n")
    drafts = [p for p in prs if p.is_bot and p.is_draft and not p.is_wip]
    if not drafts:
        print("  No draft PRs to mark.\n")
        return 0
    failed = 0
    for pr in drafts:
        print(f"  {_tag(ctx)}#{pr.number:<5} {pr.title[:50]:<50}", end="")
        if ctx.dry_run:
            print(f"{YELLOW}would mark ready{RESET}")
        else:
            try:
                gh_text("pr", "ready", str(pr.number), repo=ctx.repo_args)
                print(f"{GREEN}✓ ready{RESET}")
            except RuntimeError as e:
                print(f"{RED}✗ failed{RESET}")
                print(f"    {e}", file=sys.stderr)
                failed += 1
    print()
    return failed


def phase_approve_runs(prs: list[PRInfo], runs: list[dict], ctx: Ctx) -> int:
    print(f"{BOLD}Phase 2: Approving blocked workflow runs{RESET}\n")
    approved = failed = 0
    for pr in prs:
        if not pr.is_bot or pr.is_wip:
            continue
        blocked = [r for r in runs
                   if r.get("event") == "pull_request"
                   and r.get("headSha") == pr.head_sha
                   and (r.get("status") == "action_required"
                        or r.get("conclusion") == "action_required")]
        if not blocked:
            continue
        print(f"  PR #{pr.number}: {pr.title}")
        for run in blocked:
            rid, name = run["databaseId"], run.get("workflowName", "?")
            print(f"    {_tag(ctx)}{name:<45}", end="")
            if ctx.dry_run:
                print(f"{YELLOW}would approve{RESET}")
                approved += 1
            elif gh_post(f"actions/runs/{rid}/approve", ctx.repo_slug):
                print(f"{GREEN}✓ approved{RESET}")
                approved += 1
            elif gh_post(f"actions/runs/{rid}/rerun", ctx.repo_slug):
                print(f"{GREEN}✓ re-run{RESET}")
                approved += 1
            else:
                print(f"{RED}✗ failed{RESET}")
                failed += 1
        print()
    if not approved and not failed:
        print("  No runs needed approval.")
    elif approved:
        print(f"  Approved {approved} run(s).")
    print()
    return failed


def phase_kick_ci(prs: list[PRInfo], runs: list[dict], ctx: Ctx) -> int:
    print(f"{BOLD}Phase 3: Kicking CI for bot commits{RESET}\n")
    bot_prs = [p for p in prs if p.is_bot and not p.is_draft and not p.is_wip]
    if not bot_prs:
        print("  No bot PRs to check.\n")
        return 0
    kicked = 0
    for pr in bot_prs:
        if not is_bot_commit(ctx, pr.head_sha):
            continue
        if compute_ci_status(runs, pr.head_sha) != CIStatus.NO_RUNS:
            continue
        print(f"  {_tag(ctx)}#{pr.number:<5} {pr.title[:50]:<50}", end="")
        if ctx.dry_run:
            print(f"{YELLOW}would kick CI{RESET}")
            kicked += 1
            continue
        # This can still exist when a matching-head run was created by a non-PR event.
        prev = [r for r in runs if r.get("name") == "CI"
                and r.get("headBranch") == pr.branch and r.get("headSha") == pr.head_sha]
        if prev:
            try:
                gh_text("run", "rerun", str(prev[0]["databaseId"]), repo=ctx.repo_args)
                print(f"{GREEN}✓ re-ran{RESET}")
                kicked += 1
                continue
            except RuntimeError:
                pass  # Fall through to empty commit
        # No CI run exists for the current head — push an empty commit to trigger one.
        os.makedirs("/tmp/gh-aw/agent", exist_ok=True)
        tmpdir = tempfile.mkdtemp(prefix=f"kick_ci_{pr.number}_", dir="/tmp/gh-aw/agent")
        try:
            subprocess.run(
                ["git", "clone", "--depth=1", "--branch", pr.branch,
                 f"https://github.com/{ctx.repo_slug}.git", tmpdir],
                capture_output=True, check=True)
            subprocess.run(
                ["git", "-C", tmpdir,
                 "commit", "--allow-empty", "-m", "ci: trigger CI re-run"],
                capture_output=True, check=True)
            # Requires authenticated git credentials for github.com.
            subprocess.run(
                ["git", "-C", tmpdir, "push"],
                capture_output=True, check=True)
            print(f"{GREEN}✓ empty commit pushed{RESET}")
            kicked += 1
        except subprocess.CalledProcessError:
            print(f"{RED}✗ failed to push empty commit{RESET}")
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)
    if not kicked:
        print("  No bot PRs needed CI kicked.")
    else:
        print(f"  Kicked CI for {kicked} PR(s).")
    print()
    return 0


def phase_report(prs: list[PRInfo], runs: list[dict], ctx: Ctx) -> int:
    print(f"{BOLD}Phase 4: PR Status Report{RESET}\n")
    if not prs:
        print("  No open PRs.\n")
        return 0

    grouped: dict[PRState, list[str]] = {s: [] for s in STATE_META}
    for pr in prs:
        ci = compute_ci_status(runs, pr.head_sha)
        addr = has_active_address_wf(runs, pr.branch)
        # Only hit the commits API for bot PRs that need dynamic classification
        need_bot_check = (pr.is_bot and not pr.is_draft and not pr.is_wip
                          and pr.mergeable not in ("CONFLICTING", "UNKNOWN"))
        bot = is_bot_commit(ctx, pr.head_sha) if need_bot_check else False
        state = classify_pr(pr, ci, addr, bot)

        meta = STATE_META[state]
        detail = f"CI:{meta.ci}  Review:{pr.review_decision}" if meta.ci else ""
        if "DELEGATED" in state.value:
            detail += "  Address:running"
        grouped[state].append(f"#{pr.number:<5} {pr.title[:55]:<55} {detail}".rstrip())

    attention = 0
    for state, entries in grouped.items():
        if not entries:
            continue
        meta = STATE_META[state]
        color = _ANSI.get(meta.color, DIM)
        print(f"  {color}{BOLD}=== {meta.label} ({len(entries)}) ==={RESET}")
        for entry in entries:
            print(f"    {color}{entry}{RESET}")
        print()
        if meta.attention:
            attention += len(entries)
    return attention


def phase_summary(attention: int) -> None:
    print(f"{BOLD}Summary{RESET}")
    if attention == 0:
        print(f"  {GREEN}All PRs are in a waiting state. Nothing to do.{RESET}")
    else:
        print(f"  {YELLOW}{attention} PR(s) need attention.{RESET}\n")
        print("  Suggested next steps:")
        print("    - Merge-ready:   gh pr merge <N> --squash --delete-branch")
        print("    - Failing CI:    Delegate with @copilot or /ai comment")
        print("    - Review needed: Trigger via trigger-mention-in-pr-by-id workflow")
        print("    - Conflicts:     Rebase in worktree (see pr-state-machine.md)")
    print()


# ── Main ─────────────────────────────────────────────────────────────────────


def run_once(args: argparse.Namespace) -> int:
    """Run all phases once. Returns 0 if ok, 1 if PRs need attention."""
    ctx = Ctx(
        repo_slug=(args.repo or
                   gh_json("repo", "view", "--json", "nameWithOwner")["nameWithOwner"]),
        repo_args=["--repo", args.repo] if args.repo else [],
        dry_run=args.dry_run,
    )

    print(f"\n{BOLD}PR Management — {datetime.now():%Y-%m-%d %H:%M:%S}{RESET}")
    print(f"{DIM}Repository: {ctx.repo_slug}{RESET}")
    if ctx.dry_run:
        print(f"{YELLOW}Dry-run mode — no changes will be made{RESET}")
    if args.status_only:
        print(f"{DIM}Status-only — skipping phases 1-3{RESET}")
    print()

    prs = fetch_prs(ctx)
    runs = fetch_runs(ctx)

    if not args.status_only:
        phase_mark_drafts(prs, ctx)
        phase_approve_runs(prs, runs, ctx)
        phase_kick_ci(prs, runs, ctx)

    attention = phase_report(prs, runs, ctx)
    phase_summary(attention)
    return 1 if attention > 0 else 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manage bot-authored PRs: mark drafts ready, approve "
        "blocked runs, kick CI, and report PR status.",
    )
    parser.add_argument("--repo", help="Target repository (owner/repo)")
    parser.add_argument("--dry-run", action="store_true", help="Report without acting")
    parser.add_argument("--status-only", action="store_true", help="Skip phases 1-3")
    parser.add_argument("--loop", nargs="?", const=300, type=int, metavar="SEC",
                        help="Re-run every N seconds (default: 300)")
    args = parser.parse_args()

    # Preflight
    try:
        subprocess.run(["gh", "--version"], capture_output=True, check=True)
    except FileNotFoundError:
        sys.exit("Error: gh CLI not installed. See https://cli.github.com/")
    if subprocess.run(["gh", "auth", "status"], capture_output=True).returncode:
        sys.exit("Error: gh CLI not authenticated. Run: gh auth login")

    if args.loop is not None:
        try:
            while True:
                sys.stdout.write("\033[2J\033[H")
                sys.stdout.flush()
                rc = run_once(args)
                t = datetime.now() + timedelta(seconds=args.loop)
                s = f"{GREEN}ok{RESET}" if rc == 0 else f"{YELLOW}attention needed{RESET}"
                print(f"  {s} — next at {t:%H:%M:%S}  (Ctrl+C to stop)")
                time.sleep(args.loop)
        except KeyboardInterrupt:
            print(f"\n{DIM}Stopped.{RESET}")
    else:
        sys.exit(run_once(args))


if __name__ == "__main__":
    main()
