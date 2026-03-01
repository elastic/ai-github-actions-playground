# Elastic Peek Design Language

The canonical visual and interaction specification for Elastic Peek. AI agents and humans building UI for this project treat this document as the single authority on how things look, feel, and behave. Engineering standards (file structure, state management, testing) live in DEVELOPING.md — this document covers only design decisions.

---

## Identity

Elastic Peek is a lightweight observability tool that connects directly to Elasticsearch. It is not Kibana, not Grafana, and not a general-purpose BI tool. It is a scalpel for engineers who think in ES|QL and want fast, clear answers from their data. Dashboards use the [Perses](https://perses.dev) data model and charting framework (CNCF project, ECharts-based).

The design personality is **clinical precision with warmth**. Dense information, zero ambiguity, effortless scanning. The UI never decorates — every pixel earns its place by conveying data or enabling action. No drop shadows. No gradients. No decorative borders.

---

## Color System

### Brand Palette

Dark mode is the primary theme. Light mode is a first-class alternative, not an afterthought. Never use raw hex values in components — always reference theme tokens via the `sx` prop.

```
Token Name               Dark Mode       Light Mode
──────────────────────── ─────────────── ───────────────
background.default       #1D1E24         #F5F7FA
background.paper         #25262E         #FFFFFF
background.sunken        #16171C         #EDF0F5
background.raised        #2D2E36         #FFFFFF
text.primary             #DFE5EF         #1A1C21
text.secondary           #98A2B3         #69707D
text.disabled            #535966         #ABB4C4
primary.main             #36A2EF         #0077CC
primary.hover            #5AB4F5         #005FA3
secondary.main           #7DE2D1         #00BFB3
border.default           #343741         #D3DAE6
border.strong            #535966         #98A7B9
```

The `text.secondary` value in dark mode is `#98A2B3` — 4.6:1 contrast against `#25262E` paper background, clearing WCAG AA. Never go darker than this for secondary text.

### Status Colors

Status always uses color + icon + text label. Never color alone.

```
Semantic Name     Dark Mode       Light Mode      MUI Icon
──────────────── ─────────────── ─────────────── ──────────────
status.healthy    #54B399         #00A676         CheckCircle
status.warning    #F5A623         #D68000         Warning
status.critical   #E7664C         #BD271E         Error
status.unknown    #69707D         #98A7B9         HelpOutline
status.info       #6092C0         #0077CC         Info
```

### Chart Series Palette

Twelve colors in `CHART_COLORS` (defined in `theme.ts`), ordered for maximum adjacent contrast. CVD-safe for deuteranopia, protanopia, and tritanopia across adjacent pairs. These colors are fed to ECharts via `useEChartTheme()` and will be provided by Perses's `ChartsProvider` once the theming migration completes.

```
Index   Hex         Name
──────  ─────────── ──────────
0       #0077CC     Elastic Blue
1       #00BFB3     Teal
2       #BD271E     Red
3       #F5A623     Amber
4       #6092C0     Steel
5       #D36086     Rose
6       #9170B8     Violet
7       #CA8EAE     Mauve
8       #54B399     Sage
9       #DA8B45     Copper
10      #AA6556     Rust
11      #E7664C     Coral
```

For charts with more than 8 series, enable hover-to-highlight and click-to-isolate. The palette degrades beyond 8 simultaneous on-screen colors.

### Threshold Colors

Three levels only. Applied via `resolveThresholdColor` in `thresholdUtils.ts`.

```
success     #54B399     Value is within normal range
warning     #F5A623     Value needs attention
error       #BD271E     Value is critical
```

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

Inter is loaded as a variable font. Tabular figures are enabled globally:

```css
body { font-variant-numeric: tabular-nums lining-nums; }
```

### Type Scale

Four levels. Each maps to exactly one MUI Typography `variant`.

```
Role              MUI variant    Size    Weight    Line-Height   Use
────────────────  ───────────    ──────  ────────  ────────────  ──────────────────────────
Page Title        h6             20px    600       1.4           One per page, top-left (via PageHeader)
Large Display     h5             24px    600       1.4           Stat values, welcome headings
Section Header    subtitle1      14px    600       1.3           Card titles, group labels
Subsection        subtitle2      14px    500       1.3           Secondary headings, chip labels
Body              body1          14px    400       1.5           All prose and UI text
Caption / Data    body2          12px    400       1.4           Table headers, axis labels
```

These variants plus `caption` and `overline` are the approved set for page content. Do not introduce new uses of `h4`.

### Monospace Text

Used for: ES|QL queries, log messages, field names, index names, span IDs, API responses, and any machine-generated string. Body size mono is 13px (compensating for JetBrains Mono's wider metrics).

### Metric Display

Large stat values (KPI cards, cluster overview):

```
Metric Value     h3             32px    700       1.1
Metric Label     body2          12px    400       1.4           text.secondary color
```

`h3` is used exclusively for stat values — never for headings or section titles.

---

## Spacing

Base unit: **4px**. All spacing values are multiples of 4.

```
Token       Value     MUI sx    Use
──────────  ────────  ────────  ──────────────────────────────────
space.0     0px       0         Reset
space.1     4px       0.5       Tight inline gap (icon-to-text)
space.2     8px       1         Default inline gap, chip padding
space.3     12px      1.5       Input padding, compact card inset
space.4     16px      2         Card padding, section gap
space.5     20px      2.5       Comfortable card padding
space.6     24px      3         Page-level section separation
space.8     32px      4         Major section dividers
space.12    48px      6         Empty state vertical padding
```

### Component Heights

One density: **Compact**. Comfortable spacing is for empty states, welcome screens, and docs pages only.

```
Element              Height
───────────────────  ────────
Input / Select       36px
Button (default)     36px
Button (small)       28px
Table row            36px
Sidebar nav item     32px
Toolbar row          44px (including 4px vertical padding)
```

All interactive elements in a toolbar row must be the same height. A mismatch greater than 4px is a bug.

---

## Layout

### Page Structure

```
┌─────────────────────────────────────────────────────┐
│  AppHeader (48px, fixed top)                        │
├────────┬────────────────────────────────────────────┤
│        │  PageHeader: Title + Actions (48px)        │
│  Side  ├────────────────────────────────────────────┤
│  bar   │  ToolBar: Filters, time range, search     │
│  nav   ├────────────────────────────────────────────┤
│        │                                            │
│  68px  │  Content Area                              │
│  or    │  (scrollable, flex-grow)                   │
│  200px │                                            │
│        │                                            │
├────────┴────────────────────────────────────────────┤
│  (no footer — status info goes in header or inline) │
└─────────────────────────────────────────────────────┘
```

Sidebar: `200px` expanded, `68px` collapsed. Persists across pages. Collapse state in localStorage.

### Page Archetypes

**Grid** (Dashboards, Cluster Overview, Metrics): `react-grid-layout` panels with drag-resize. Max 12 panels per viewport. F-pattern reading order. Dashboards serialize to the Perses resource format (`kind: "Dashboard"` with `kind: "Panel"` entries). Layout adapters in `perses/layoutAdapter.ts` convert between Perses grid specs and react-grid-layout items.

**Table** (Indices, Data Streams, Ingest Pipelines, Users, Roles): Full-width sortable table with filter/search toolbar above. Detail sidebar or flyout on row click.

**Explorer** (Discover, Traces, Query Lab): Split-pane with query input above, results below. Resizable split. CodeMirror editor.

**Detail** (Trace Detail, Fleet Agent): Header with key metadata, tabbed content below.

### Cards and Panels

```tsx
sx={{
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,           // 8px
  p: 2,                       // 16px
}}
```

No drop shadows. No gradients. Active/selected card: `2px` left border in `primary.main`. Panel headers: 36px tall, title at subtitle1, kebab menu right-aligned on hover.

---

## Components

### Empty States

Every page that can show "no data" renders the `EmptyState` component. Required anatomy:

- Centered icon (48px, `text.secondary`)
- Bold title (`subtitle1`, 600 weight)
- One-line description (`body2`)
- Optional action button

No blank rectangles anywhere. Branching on empty data without rendering `EmptyState` is a bug.

### Tables (DataTable)

Column headers: `body2`, 600 weight, `text.secondary`, `textTransform: 'uppercase'`, `letterSpacing: '0.04em'`. Rows: `body1`, `text.primary`. No alternating row stripes (divider lines are sufficient). Numeric columns right-align. Pagination: `[25, 50, 100]` rows-per-page.

Cell truncation via `text-overflow: ellipsis`. Hover tooltip for full value. Row click opens `RowInspectorFlyout` (right-side drawer).

### Stat Cards (StatPanel)

Value: `h3` (32px/700), colored by threshold or series palette, centered. Label: `body2`, `text.secondary`, below value. Multiple stats flex-wrap with `gap: 32px`.

### Time Range Controls

`DateRangePicker`: top-right of page header or toolbar. Compact display string ("Last 15 minutes"). Quick presets: 5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h, 7d, 30d (defined in `timePresets.ts`). `RefreshIntervalPicker` adjacent right.

### Query Editor

CodeMirror 6 with `@codemirror/lang-sql`, ES|QL highlighting from `esqlSyntaxGuide.ts`. Background: `background.sunken`. Font: JetBrains Mono 13px. Line numbers on, minimap off. Resizable height via drag handle. Ghost-diff extension renders AI completions as dimmed inline text (Tab to accept, Escape to dismiss).

### Charts (Perses)

Peek uses [Perses](https://perses.dev) as its charting framework. Perses is a CNCF project built on ECharts that provides a plugin-based panel system, dashboard-as-code data model, and embeddable chart components with MUI theme integration. For architecture layers, code-structure rules, and registration steps, see DEVELOPING.md § Perses Architecture. For the migration roadmap, see PERSES_MIGRATION_PLAN.md.

**Design rules for charts:**

- Colors come from the theme (via `useEChartTheme()` or the Perses `ChartsProvider`). No hardcoded hex values in chart options.
- Tooltip style: `background.raised` fill, `divider` border, `text.primary` content, 12px Inter. Crosshair cursor on time-series.
- For charts with >8 series, enable hover-to-highlight and click-to-isolate.
- Export via `getDataURL()`. Chart data must also be accessible as a table via the Inspect panel.

### Sidebar Navigation

Section headers: 11px/600, `text.secondary`, uppercase, `letterSpacing: '0.02em'`. Active item: `primary.main` text+icon, 3px left accent bar, `action.selected` background. Items built from `PAGE_MANIFEST` — never hardcoded.

### Connection Dialog

Centered dialog. URL input, auth tabs (API Key / Username+Password), Connect button. Profiles via `connectionProfileSlice.ts`, switchable via `ConnectionProfileSwitcher`.

### Command Palette

`Cmd+K` / `Ctrl+K`. Centered modal, search input. Results grouped: Navigation, Actions, Recent Queries.

---

## Interaction Patterns

### Loading

Indeterminate `LinearProgress` bar below toolbar, above content. Components render structural skeleton (headers, empty card boundaries) — never a spinner, never a blank screen.

### Errors

Inline `Alert` with `severity="error"` at top of affected content area. Includes error message and "Retry" action. Errors never block navigation to other pages.

### Transitions

Route changes: instant, no animation. Panel resize / sidebar collapse: `theme.transitions.duration.shorter` (150ms). Chart rendering: no entrance animation. Respect `prefers-reduced-motion`.

### Keyboard

All interactive elements reachable via Tab. Escape dismisses any overlay. Focus rings use browser default — never suppress `outline`. Command palette is the keyboard shortcut hub.

---

## Accessibility

WCAG 2.2 Level AA is the floor.

- **4.5:1** contrast for body text (14px)
- **3:1** for large text (≥18px or ≥14px bold) and non-text UI (borders, icons, chart elements)
- Status: always color + icon + text label
- Form inputs: visible `<label>` via `htmlFor`
- Semantic HTML: `<button>` for actions, `<a>` for navigation, `<nav>` / `<main>` landmarks
- Focus: moves to main content on route change, returns to trigger on dialog close
- `aria-current="page"` on active sidebar item
- `aria-label` on icon-only buttons
- Chart data accessible as table via "Inspect" panel action

---

## Banned Patterns

These are never correct in this codebase. Agents must not generate them. For engineering/code-structure bans (barrel imports, direct ECharts imports, data fetching in chart components), see DEVELOPING.md § Banned Code Patterns.

```tsx
// ❌ Inline hex colors
<Box sx={{ color: '#69707D', bgcolor: '#25262E' }}>
// ✅
<Box sx={{ color: 'text.secondary', bgcolor: 'background.paper' }}>

// ❌ Disallowed Typography variants
<Typography variant="h4">Section Title</Typography>
// ✅
<Typography variant="subtitle1">Section Title</Typography>

// ❌ Clickable divs
<Box onClick={handleClick} sx={{ cursor: 'pointer' }}>
// ✅
<Button onClick={handleClick}>
// ✅ (if unstyled)
<ButtonBase onClick={handleClick}>

// ❌ Spinner for loading
<CircularProgress />
// ✅
<LinearProgress />

// ❌ Drop shadows on surfaces
<Paper elevation={3}>
// ✅
<Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>

// ❌ Gradients on surfaces
<Box sx={{ background: 'linear-gradient(...)' }}>
// ✅
<Box sx={{ bgcolor: 'background.paper' }}>

// ❌ Blank rectangle when data is empty
{data.length === 0 && <Box />}
// ✅
{data.length === 0 && <EmptyState heading="No results" description="..." />}

// ❌ Hardcoded colors in ECharts options
series: [{ itemStyle: { color: '#0077CC' } }]
// ✅ Colors come from useEChartTheme() or ChartsProvider
const theme = useEChartTheme();
```

---

## Component Patterns for Agents

### Reusable component interfaces

```tsx
// src/components/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}
```

- Wrap headers in `<Paper variant="outlined" sx={{ p: 1.5 }}>`.
- Use `actions` for right-aligned controls.
- Title renders as `<Typography variant="h6" component="h1">`.

```tsx
// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  action?: React.ReactNode;
  size?: "small" | "medium"; // default "medium"
}
```

- Use `size="small"` for inline panel/card empty states.
- Use `size="medium"` for page-level empty states.
- Empty-data branches are enforced by the `enforce-empty-state` ESLint rule.

```tsx
// src/components/ContentSkeleton.tsx
interface ContentSkeletonProps {
  variant: "table" | "cards" | "chart";
}
```

- Use while loading in the same container that will render real content.

### Standard page layout pattern

```tsx
return (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader
        title="Page Name"
        actions={<Button size="small">Action</Button>}
      />
    </Paper>

    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.5 }}>
      {loading && <ContentSkeleton variant="table" />}
      {!loading && data.length === 0 && (
        <EmptyState heading="No items found" description="Try adjusting filters." />
      )}
      {!loading && data.length > 0 && <DataTable rows={data} />}
    </Paper>
  </Box>
);
```

### Canonical templates

#### Table page (sorting + pagination)

```tsx
const [page, setPage] = useState(0);
const [pageSize, setPageSize] = useState(25);
const [sortBy, setSortBy] = useState<string>("name");
const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

function handleSortChange(nextSortBy: string, nextDirection: "asc" | "desc") {
  setSortBy(nextSortBy);
  setSortDirection(nextDirection);
  setPage(0);
}

return (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <PageHeader title="Indices" actions={<Button size="small">Refresh</Button>} />
    </Paper>
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.5 }}>
      {loading && <ContentSkeleton variant="table" />}
      {!loading && rows.length === 0 && <EmptyState heading="No data" description="Try adjusting filters." />}
      {!loading && rows.length > 0 && (
        <DataTable
          rows={rows}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSortChange={handleSortChange}
        />
      )}
    </Paper>
  </Box>
);
```

#### Form dialog (validation + submit/cancel)

```tsx
function SaveViewDialog({ open, onCancel, onSaved }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await saveView({ name: name.trim() });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save view.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Save view</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(error)}
          helperText={error ?? " "}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### Spacing decision table

MUI spacing multiplier = `n × 8px`. Only values in the `SpaceToken` set are permitted: `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6`.

| Context | Token | px | Example |
|---------|-------|----|---------|
| Container padding | `1.5` | 12px | `<Paper sx={{ p: 1.5 }}>` |
| Gap between sections | `1` | 8px | `<Box sx={{ gap: 1 }}>` |
| Inline element gap | `0.5` | 4px | `<Box sx={{ gap: 0.5 }}>` |
| Section margin | `2` | 16px | `<Box sx={{ mt: 2 }}>` |
| Dense list item padding | `0.5` | 4px | `<ListItemButton sx={{ py: 0.5 }}>` |

### Design tokens reference

Use `src/types/tokens.ts` (`peek/src/types/tokens.ts` at repo root) for agent-safe token unions:

- `StatusColor`: `"healthy" | "warning" | "critical" | "unknown" | "info"`
- `SpaceToken`: `0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 6`
- `TypographyVariant`: `"h5" | "h6" | "subtitle1" | "subtitle2" | "body1" | "body2" | "caption" | "overline"`
- `MetricTypographyVariant`: `"h3"`

### Banned implementation patterns (agent checklist)

- Never use `CircularProgress` for page-level loading; use `ContentSkeleton`.
- Never use raw `<div onClick>` / `<Box onClick>`; use `Button`, `IconButton`, `ButtonBase`, or `ListItemButton`.
- Never use hardcoded hex colors in `sx`; use theme tokens (`theme.palette.*` / token keys).
- Never return bare empty-state placeholders like `<div />` or `<Typography>No data</Typography>`; use `<EmptyState />`.
- Typography variants for generated UI must be limited to: `h3` (metric values only), `h5` (large display values), `h6` (page titles via PageHeader), `subtitle1`, `subtitle2`, `body1`, `body2`, `caption`, `overline`. Never use `h4`.
