# /file-issue — Research, Design, and File a GitHub Issue

## When to Use

Use `/file-issue` when you want to propose a new feature, enhancement, or bug fix as a structured GitHub issue. This skill follows the project's agentic workflow: issues contain agent-ready implementation plans that AI agents can pick up and execute.

## Workflow

### 1. Research the Codebase

Before designing anything, explore the relevant parts of the codebase:

- Identify existing patterns that the new work should follow
- Find the specific files, components, hooks, and query builders involved
- Check for prior art — has something similar been built before?
- Review `DESIGN_LANGUAGE.md` for visual/interaction constraints
- Review `DEVELOPING.md` for engineering standards and architecture

### 2. Design the Architecture

Structure the issue body with these sections:

- **Context**: Why this change is needed, what problem it solves
- **Goals**: Numbered list of concrete deliverables
- **Proposed Architecture**: Technical design with:
  - Data sources and field mappings (if applicable)
  - Page/component structure (following existing archetypes from DESIGN_LANGUAGE.md)
  - Query builders (following `*QueryBuilder.ts` pattern)
  - Store slices (if new state is needed)
  - Route definitions (if new pages)
  - Cross-linking with existing features
- **Implementation Phases**: Ordered checklist of work packages
- **Decisions**: Explicit design decisions and trade-offs

### 3. Ask Clarifying Questions

Before filing, use `AskUserQuestion` to resolve ambiguity on:

- Data sources and index patterns
- Scope (which entity levels, which signal types)
- Cross-linking strategy with existing features
- Any assumptions that affect architecture

### 4. File the Issue

Use `gh issue create` with:

```bash
gh issue create --title "feat: <concise title>" --body "$(cat <<'EOF'
<structured issue body>
EOF
)"
```

## Quality Checklist

- [ ] Title is concise and starts with `feat:`, `fix:`, or `chore:`
- [ ] Context explains the "why" clearly
- [ ] Architecture names specific files, components, and patterns
- [ ] Implementation phases are ordered and have checkboxes
- [ ] Decisions section documents trade-offs explicitly
- [ ] References existing patterns in the codebase (e.g., "following ServiceInventoryTable pattern")
- [ ] No speculative features — only what was discussed and agreed upon
