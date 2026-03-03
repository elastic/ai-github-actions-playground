# /new-experience — Scaffold a Curated Observability Experience

## When to Use

Use `/new-experience` when building a new "curated experience" — a two-level inventory-to-dashboard view for a specific observability domain (like Services, Kubernetes, Logs, etc.). This skill ensures new experiences follow the established Services pattern.

## Reference Implementation: Services Experience

The Services experience is the canonical pattern. All new experiences should mirror its structure:

```
peek/src/components/services/
├── ServiceInventoryPage.tsx          # Top-level page with table + overview cards
├── ServiceInventoryTable.tsx         # Sortable/searchable inventory table
├── ServiceOverviewCards.tsx          # Summary stat cards above the table
├── ServiceInsightsPanel.tsx          # AI-powered insights panel
├── ServiceDashboardPage.tsx          # Detail dashboard for a single entity
├── ServiceDashboardControls.tsx      # Dashboard-level filters and time range
├── ServiceDashboardSummaryCards.tsx  # Summary cards on the dashboard
├── ServicePerformanceCharts.tsx      # Time-series charts
├── ServiceRoutesPanel.tsx            # Sub-entity table panel
├── ServiceTracesPanel.tsx            # Related traces panel
├── serviceInventoryQueryBuilder.ts   # ES|QL queries for inventory
├── serviceInventoryHelpers.ts        # Response parsers, formatters, types
├── serviceDashboardQueryBuilder.ts   # ES|QL queries for dashboard
├── serviceDashboardHelpers.ts        # Dashboard response parsers
├── serviceDashboardPageUtils.ts      # Shared dashboard utilities
├── useServiceInventorySearch.ts      # Inventory data-fetching hook
└── useServiceDashboardQueries.ts     # Dashboard data-fetching hook
```

## Scaffold Checklist

### 1. Data Layer

- [ ] **Field mapping type** — `interface <Domain>FieldMapping` with all relevant OTel/ES fields
- [ ] **Default field mapping** — `DEFAULT_<DOMAIN>_FIELD_MAPPING` constant
- [ ] **Query builder** — `<domain>InventoryQueryBuilder.ts` with ES|QL query builders
- [ ] **Helpers** — `<domain>InventoryHelpers.ts` with response parsers and row types
- [ ] **Dashboard query builder** — `<domain>DashboardQueryBuilder.ts`
- [ ] **Dashboard helpers** — `<domain>DashboardHelpers.ts`

### 2. State

- [ ] **Store slice** — Add filters to `usePageFiltersStore.ts` or create a dedicated store
- [ ] **Data-fetching hooks** — `use<Domain>InventorySearch.ts`, `use<Domain>DashboardQueries.ts`

### 3. Inventory Page

- [ ] **Page component** — `<Domain>InventoryPage.tsx` (tabbed if multiple entity levels)
- [ ] **Overview cards** — `<Domain>OverviewCards.tsx` (total counts, error rates)
- [ ] **Inventory table** — `<Domain>InventoryTable.tsx` (sortable, searchable, row click drills down)
- [ ] **Insights panel** — `<Domain>InsightsPanel.tsx` (AI-powered anomaly detection)

### 4. Dashboard Page

- [ ] **Page component** — `<Domain>DashboardPage.tsx`
- [ ] **Controls** — `<Domain>DashboardControls.tsx` (time range, filters)
- [ ] **Summary cards** — `<Domain>DashboardSummaryCards.tsx`
- [ ] **Charts** — Domain-specific time-series panels
- [ ] **Sub-entity panels** — Tables for related entities

### 5. Integration

- [ ] **Routes** — Add to `manifest.ts` (inventory + dashboard routes)
- [ ] **Sidebar nav** — Add nav item to sidebar
- [ ] **Cross-links** — Bidirectional navigation with related experiences

### 6. Testing

- [ ] Unit tests for query builders and helpers
- [ ] Component tests for inventory page (loading, empty, data states)
- [ ] Component tests for dashboard page
- [ ] Accessibility checks via `renderWithA11y`

## Naming Conventions

Follow these patterns (replace `Service` with your domain name):

| Pattern | Example |
|---------|---------|
| Page | `ServiceInventoryPage.tsx`, `ServiceDashboardPage.tsx` |
| Table | `ServiceInventoryTable.tsx` |
| Cards | `ServiceOverviewCards.tsx`, `ServiceDashboardSummaryCards.tsx` |
| Query builder | `serviceInventoryQueryBuilder.ts` |
| Helpers | `serviceInventoryHelpers.ts` |
| Hook | `useServiceInventorySearch.ts` |
| Store slice | `use<Domain>FiltersStore.ts` or slice in `usePageFiltersStore.ts` |

## Design Constraints

- Follow `DESIGN_LANGUAGE.md` for all visual patterns
- Use `COMPONENT_HEIGHTS` from `src/types/tokens.ts` for standard heights
- Use approved spacing tokens only: `0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6`
- Use `ButtonBase` for clickable rows (not `Box onClick`)
- Use `ContentSkeleton` for loading states, `EmptyState` for empty data
- Import MUI components from path imports (e.g., `@mui/material/Box`)
- Separate import groups with blank lines
