---
name: review-pr
description: Fetch and address PR review comments on the current branch's pull request
user_invocable: true
---

# Review PR Feedback

When the user invokes `/review-pr` or asks to address PR reviews, follow this workflow:

## 1. Identify the PR

```bash
gh pr view --json number,url,headRefName --jq '{number, url, branch: .headRefName}'
```

If no PR exists for the current branch, tell the user.

## 2. Fetch all review comments

Fetch **both** review comments (inline code comments) and issue-level comments:

```bash
# Inline review comments
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | {path: .path, line: .line, body: .body, author: .user.login, id: .id}'

# Issue-level comments (includes bot summaries, CI reports)
gh api repos/{owner}/{repo}/issues/{number}/comments --jq '.[] | {body: .body, author: .user.login, id: .id}'

# Review summaries with state (APPROVED, CHANGES_REQUESTED, COMMENTED)
gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '.[] | {state: .state, body: .body, author: .user.login}'
```

## 3. Triage feedback

Categorize each comment:

- **Actionable code fix** — a specific change requested (ARIA attrs, bug fix, rename, etc.)
- **Test fix needed** — E2E or unit test needs updating
- **CI failure** — a build/test/lint failure from CI bots
- **Nitpick/style** — optional style suggestions (address if low-effort)
- **Already fixed** — comment on code that was already addressed in a later commit
- **Informational** — walkthrough summaries, bot reports (no action needed)

Skip informational comments and already-fixed items. Focus on actionable fixes.

## 4. Apply fixes

For each actionable item:

1. Read the file at the referenced path/line
2. Make the fix
3. If the fix changes component props or behavior, update callers too
4. If it affects test assertions, update the relevant tests

## 5. Verify

```bash
npx tsc --noEmit
npx eslint <changed-files>
npx vitest run <relevant-test-files>
```

If all pass, run the full suite:

```bash
npx vitest run
```

## 6. Commit and push

Commit with a descriptive message referencing the PR feedback:

```
fix: address PR review feedback — <brief summary>
```

Push to the same branch so the PR updates.

## 7. Reply (optional)

If the user asks, you can post replies to resolved comments:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies -f body="Fixed in <commit-sha>"
```
